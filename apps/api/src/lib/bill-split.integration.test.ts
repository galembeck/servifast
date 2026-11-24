import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { PrismaClient } from "../generated/prisma/client.js";
import {
	createBillSplit,
	payBillInvoice,
	previewBillSplit,
	readBillSplit,
} from "./bill-split";
import { fetchCashFlow } from "./cash-flow";
import { getCashSalesInCents } from "./cash-register";
import { fetchSalesReport, fetchTopProducts } from "./sales-report";

const url = process.env.SERVIFAST_TEST_DATABASE_URL;
describe.skipIf(!url)("split checkout PostgreSQL transactions", () => {
	let db: PrismaClient;
	const owner = randomUUID();
	let rid: string, pid: string, category: string, tableNumber: number;
	let cleanup: string[] = [];
	beforeAll(async () => {
		db = new PrismaClient({
			adapter: new PrismaPg({ connectionString: url ?? "" }),
		});
		await db.user.create({
			data: { id: owner, email: `${owner}@snexs142.test` },
		});
	}, 30_000);
	beforeEach(async () => {
		rid = randomUUID();
		pid = randomUUID();
		category = randomUUID();
		tableNumber = 0;
		cleanup = [rid];
		await db.restaurant.create({
			data: {
				id: rid,
				name: "SNEXS-142 test",
				slug: `split-${rid}`,
				ownerId: owner,
			},
		});
		await db.menuCategory.create({
			data: { id: category, restaurantId: rid, name: "Teste" },
		});
		await db.menuItem.create({
			data: {
				id: pid,
				categoryId: category,
				restaurantId: rid,
				name: "Produto",
				priceInCents: 10_000,
				stockQuantity: 100,
			},
		});
	});
	afterEach(async () => {
		await db.restaurant.deleteMany({ where: { id: { in: cleanup } } });
	});
	afterAll(async () => {
		try {
			await db.user.deleteMany({ where: { id: owner } });
		} finally {
			await db.$disconnect();
		}
	});
	async function tab(price = 10_000, quantity = 1) {
		const table = await db.table.create({
			data: {
				restaurantId: rid,
				number: ++tableNumber,
				seatsCount: 2,
				status: "OCCUPIED",
				occupiedSeats: 1,
			},
		});
		return db.tab.create({
			data: {
				restaurantId: rid,
				tableId: table.id,
				items: {
					create: {
						restaurantId: rid,
						menuItemId: pid,
						quantity,
						unitPriceInCents: price,
						status: "DELIVERED",
					},
				},
			},
			include: { items: true },
		});
	}
	async function divide(tabId: string, people = 2) {
		const input = { mode: "PEOPLE" as const, people, requestId: randomUUID() };
		const preview = await previewBillSplit(db, tabId, rid, input);
		const body = { ...input, previewToken: preview.fingerprint };
		const split = await createBillSplit(db, tabId, rid, body);
		if (!split) {
			throw new Error("Missing split");
		}
		return { split, body };
	}
	it("creates one split for duplicate/concurrent requests and preserves paid values", async () => {
		const t = await tab();
		const input = {
			mode: "PEOPLE" as const,
			people: 3,
			requestId: randomUUID(),
		};
		const preview = await previewBillSplit(db, t.id, rid, input);
		const body = { ...input, previewToken: preview.fingerprint };
		const [a, b] = await Promise.all([
			createBillSplit(db, t.id, rid, body),
			createBillSplit(db, t.id, rid, body),
		]);
		expect(a?.id).toBe(b?.id);
		expect(a?.invoices.map((p) => p.amountInCents)).toEqual([3334, 3333, 3333]);
		const id = a?.invoices[0]?.id;
		if (!id) {
			throw new Error("Missing invoice");
		}
		await Promise.all([
			payBillInvoice(db, t.id, rid, id, owner, {
				method: "CASH",
				receivedInCents: 5000,
			}),
			payBillInvoice(db, t.id, rid, id, owner, {
				method: "CASH",
				receivedInCents: 5000,
			}),
		]);
		expect(await db.payment.count({ where: { tabId: t.id } })).toBe(1);
		const first = await db.payment.findUniqueOrThrow({
			where: { invoiceId: id },
		});
		await expect(
			payBillInvoice(db, t.id, rid, id, owner, { method: "PIX" })
		).rejects.toMatchObject({ code: "INVOICE_ALREADY_PAID" });
		expect(await db.payment.findUnique({ where: { invoiceId: id } })).toEqual(
			first
		);
		await expect(
			createBillSplit(db, t.id, rid, { ...body, people: 2 })
		).rejects.toMatchObject({ code: "BILL_SPLIT_LOCKED" });
		const reloaded = await readBillSplit(db, t.id, rid);
		expect(reloaded?.paidInCents).toBe(3334);
		expect(reloaded?.remainingInCents).toBe(6666);
		expect(
			(await db.tab.findUniqueOrThrow({ where: { id: t.id } })).closedAt
		).toBeNull();
		expect(
			(await db.menuItem.findUniqueOrThrow({ where: { id: pid } }))
				.stockQuantity
		).toBe(99);
	});
	it("settles concurrent final invoices once, counts one sale/items once, and reconciles mixed methods", async () => {
		const t = await tab(5000, 2);
		const { split } = await divide(t.id);
		const a = split.invoices[0],
			b = split.invoices[1];
		if (!(a && b)) {
			throw new Error("Missing invoices");
		}
		await Promise.all([
			payBillInvoice(db, t.id, rid, a.id, owner, {
				method: "CASH",
				receivedInCents: 6000,
			}),
			payBillInvoice(db, t.id, rid, b.id, owner, { method: "PIX" }),
		]);
		const state = await readBillSplit(db, t.id, rid);
		expect(state?.remainingInCents).toBe(0);
		expect(state?.closedAt).not.toBeNull();
		expect(
			(await db.table.findUniqueOrThrow({ where: { id: t.tableId } })).status
		).toBe("FREE");
		expect(
			(await db.menuItem.findUniqueOrThrow({ where: { id: pid } }))
				.stockQuantity
		).toBe(98);
		const now = new Date(Date.now() + 1000);
		const sales = await fetchSalesReport(db, rid, "today", now);
		expect(sales.kpis).toMatchObject({
			revenueInCents: 10_000,
			salesCount: 1,
			itemsSold: 2,
		});
		expect(sales.topItems[0]?.quantity).toBe(2);
		expect(
			sales.byPaymentMethod.find((p) => p.method === "CASH")
		).toMatchObject({ revenueInCents: 5000, salesCount: 1 });
		expect(sales.byPaymentMethod.find((p) => p.method === "PIX")).toMatchObject(
			{ revenueInCents: 5000, salesCount: 1 }
		);
		const products = await fetchTopProducts(db, rid, "today", now);
		expect(products.products[0]).toMatchObject({
			quantity: 2,
			servicesCount: 1,
			averageTicketWithItemInCents: 10_000,
		});
		expect(
			(await fetchCashFlow(db, rid, "today", now)).totals.incomingInCents
		).toBe(10_000);
		expect(await getCashSalesInCents(db, rid, new Date(0))).toBe(5000);
	});
	it("apportions item units and adjustments while excluding cancelled lines", async () => {
		const t = await tab(755, 3);
		await db.orderItem.create({
			data: {
				tabId: t.id,
				restaurantId: rid,
				menuItemId: pid,
				quantity: 99,
				unitPriceInCents: 99_999,
				status: "CANCELLED",
			},
		});
		const item = t.items[0];
		if (!item) {
			throw new Error("Missing item");
		}
		const input = {
			mode: "ITEMS" as const,
			requestId: randomUUID(),
			serviceFee: { type: "PERCENT" as const, basisPoints: 1000 },
			discount: { type: "FIXED" as const, amountInCents: 100 },
			clients: [
				{ name: "A", items: [{ itemId: item.id, quantity: 1 }] },
				{ name: "B", items: [{ itemId: item.id, quantity: 2 }] },
			],
		};
		const preview = await previewBillSplit(db, t.id, rid, input);
		expect(preview.parts.map((p) => p.amountInCents)).toEqual([798, 1594]);
		const split = await createBillSplit(db, t.id, rid, {
			...input,
			previewToken: preview.fingerprint,
		});
		expect(split?.amountInCents).toBe(2392);
		for (const invoice of split?.invoices ?? []) {
			await payBillInvoice(db, t.id, rid, invoice.id, owner, {
				method: "DEBIT_CARD",
			});
		}
		expect(
			(await db.menuItem.findUniqueOrThrow({ where: { id: pid } }))
				.stockQuantity
		).toBe(97);
	});
	it("rejects invalid assignments and a stale preview without freezing the tab", async () => {
		const t = await tab(100, 3);
		const item = t.items[0];
		if (!item) {
			throw new Error("Missing item");
		}
		await expect(
			previewBillSplit(db, t.id, rid, {
				mode: "ITEMS",
				requestId: randomUUID(),
				clients: [
					{ name: "A", items: [{ itemId: item.id, quantity: 1 }] },
					{ name: "B", items: [{ itemId: item.id, quantity: 1 }] },
				],
			})
		).rejects.toMatchObject({ code: "INVALID_SPLIT" });
		const input = {
			mode: "PEOPLE" as const,
			people: 2,
			requestId: randomUUID(),
		};
		const p = await previewBillSplit(db, t.id, rid, input);
		await db.orderItem.update({
			where: { id: item.id },
			data: { quantity: 4 },
		});
		await expect(
			createBillSplit(db, t.id, rid, { ...input, previewToken: p.fingerprint })
		).rejects.toMatchObject({ code: "SPLIT_CHANGED" });
		expect(await db.billSplit.count({ where: { tabId: t.id } })).toBe(0);
	});
	it("blocks item mutations in the database and another restaurant's access", async () => {
		const t = await tab();
		await divide(t.id);
		const item = t.items[0];
		if (!item) {
			throw new Error("Missing item");
		}
		await expect(
			db.orderItem.update({ where: { id: item.id }, data: { quantity: 2 } })
		).rejects.toThrow("BILL_SPLIT_LOCKED");
		await expect(
			db.orderItem.create({
				data: {
					tabId: t.id,
					restaurantId: rid,
					menuItemId: pid,
					quantity: 1,
					unitPriceInCents: 100,
					status: "RECEIVED",
				},
			})
		).rejects.toThrow("BILL_SPLIT_LOCKED");
		const other = randomUUID();
		await expect(
			previewBillSplit(db, t.id, other, {
				mode: "PEOPLE",
				people: 2,
				requestId: randomUUID(),
			})
		).rejects.toMatchObject({ code: "TAB_NOT_FOUND" });
		expect(
			(await db.orderItem.findUniqueOrThrow({ where: { id: item.id } }))
				.quantity
		).toBe(1);
	});
	it("rolls back a stock shortage before any receipt; later stock changes cannot strand a paid split", async () => {
		const t = await tab();
		const { split } = await divide(t.id);
		const a = split.invoices[0],
			b = split.invoices[1];
		if (!(a && b)) {
			throw new Error("Missing invoices");
		}
		await db.menuItem.update({
			where: { id: pid },
			data: { stockQuantity: 0 },
		});
		await expect(
			payBillInvoice(db, t.id, rid, a.id, owner, { method: "PIX" })
		).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
		expect(await db.payment.count({ where: { tabId: t.id } })).toBe(0);
		expect(
			(await db.tab.findUniqueOrThrow({ where: { id: t.id } })).stockDebitedAt
		).toBeNull();
		await db.menuItem.update({
			where: { id: pid },
			data: { stockQuantity: 1 },
		});
		await payBillInvoice(db, t.id, rid, a.id, owner, { method: "PIX" });
		const debit = (await db.tab.findUniqueOrThrow({ where: { id: t.id } }))
			.stockDebitedAt;
		expect(debit).not.toBeNull();
		expect(
			(await db.menuItem.findUniqueOrThrow({ where: { id: pid } }))
				.stockQuantity
		).toBe(0);
		await payBillInvoice(db, t.id, rid, b.id, owner, { method: "CREDIT_CARD" });
		const closed = await db.tab.findUniqueOrThrow({ where: { id: t.id } });
		expect(closed.closedAt).not.toBeNull();
		expect(closed.stockDebitedAt).toEqual(debit);
		expect(
			(await db.menuItem.findUniqueOrThrow({ where: { id: pid } }))
				.stockQuantity
		).toBe(0);
	});
});
