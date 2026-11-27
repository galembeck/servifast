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
import { registerPartialPayment, settlePartialTab } from "./partial-payment";
import { fetchSalesReport, fetchTopProducts } from "./sales-report";

const url = process.env.SERVIFAST_TEST_DATABASE_URL;
describe.skipIf(!url)("partial checkout PostgreSQL transactions", () => {
	let db: PrismaClient;
	const owner = randomUUID();
	let rid: string, pid: string, category: string, tableNumber: number;
	let cleanup: string[] = [];
	beforeAll(async () => {
		db = new PrismaClient({
			adapter: new PrismaPg({ connectionString: url ?? "" }),
		});
		await db.user.create({
			data: { id: owner, email: `${owner}@snexs148.test` },
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
				name: "SNEXS-148 test",
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
	function partial(
		tabId: string,
		amountInCents = 3000,
		requestId = randomUUID()
	) {
		return registerPartialPayment(db, tabId, rid, owner, {
			amountInCents,
			requestId,
			method: "CASH",
			receivedInCents: amountInCents,
		});
	}
	it("persists 30/100, stays open/occupied, settles 70 once without a second stock debit", async () => {
		const t = await tab();
		const first = await partial(t.id);
		expect(first?.paidInCents).toBe(3000);
		expect(first?.remainingInCents).toBe(7000);
		const open = await db.tab.findUniqueOrThrow({
			where: { id: t.id },
			include: { table: true },
		});
		expect(open.closedAt).toBeNull();
		expect(open.table.status).toBe("OCCUPIED");
		expect((await readBillSplit(db, t.id, rid))?.remainingInCents).toBe(7000);
		await db.menuItem.update({
			where: { id: pid },
			data: { stockQuantity: 0 },
		});
		const input = { requestId: randomUUID(), method: "PIX" as const };
		const [a, b] = await Promise.all([
			settlePartialTab(db, t.id, rid, owner, input),
			settlePartialTab(db, t.id, rid, owner, input),
		]);
		expect(a.payment.id).toBe(b.payment.id);
		expect(a.payment.amountInCents).toBe(7000);
		const closed = await db.tab.findUniqueOrThrow({
			where: { id: t.id },
			include: { table: true },
		});
		expect(closed.closedAt).not.toBeNull();
		expect(closed.table.status).toBe("FREE");
		expect(closed.stockDebitedAt).toEqual(open.stockDebitedAt);
		expect(await db.payment.count({ where: { tabId: t.id } })).toBe(2);
		const now = new Date(),
			start = new Date(now.getTime() - 60_000);
		expect(await getCashSalesInCents(db, rid, start)).toBe(3000);
		expect(
			(await fetchCashFlow(db, rid, "today", now)).totals.incomingInCents
		).toBe(10_000);
		const sales = await fetchSalesReport(db, rid, "today", now);
		expect(sales.kpis).toMatchObject({
			revenueInCents: 10_000,
			salesCount: 1,
			itemsSold: 1,
		});
		const products = await fetchTopProducts(db, rid, "today", now);
		expect(products.products[0]?.quantity).toBe(1);
	}, 30_000);
	it("replays one request and serializes competing receipts without overpayment", async () => {
		const t = await tab();
		const id = randomUUID();
		await Promise.all([partial(t.id, 3000, id), partial(t.id, 3000, id)]);
		expect(await db.payment.count({ where: { tabId: t.id } })).toBe(1);
		await expect(partial(t.id, 4000, id)).rejects.toMatchObject({
			code: "PAYMENT_REQUEST_CONFLICT",
		});
		const results = await Promise.allSettled([
			partial(t.id, 5000),
			partial(t.id, 5000),
		]);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		expect((await readBillSplit(db, t.id, rid))?.remainingInCents).toBe(2000);
		expect(
			(await db.menuItem.findUniqueOrThrow({ where: { id: pid } }))
				.stockQuantity
		).toBe(99);
	}, 30_000);
	it("rejects zero, negative, equal/above balance and foreign restaurant without changing data", async () => {
		const t = await tab();
		for (const amount of [0, -1, 10_000, 10_001]) {
			await expect(partial(t.id, amount)).rejects.toMatchObject({
				code: "INVALID_PARTIAL_PAYMENT",
			});
		}
		await expect(
			registerPartialPayment(db, t.id, randomUUID(), owner, {
				amountInCents: 3000,
				requestId: randomUUID(),
				method: "PIX",
			})
		).rejects.toMatchObject({ code: "TAB_NOT_FOUND" });
		expect(await db.billSplit.count({ where: { tabId: t.id } })).toBe(0);
		expect(await db.payment.count({ where: { tabId: t.id } })).toBe(0);
		expect(
			(await db.menuItem.findUniqueOrThrow({ where: { id: pid } }))
				.stockQuantity
		).toBe(100);
		await partial(t.id);
		await settlePartialTab(db, t.id, rid, owner, { method: "PIX" });
		await expect(partial(t.id, 1)).rejects.toMatchObject({
			code: "TAB_NOT_OPEN",
		});
		expect(await db.payment.count({ where: { tabId: t.id } })).toBe(2);
	}, 30_000);
	it("rolls back snapshot, receipt and debit on shortage and can retry the same request", async () => {
		const t = await tab();
		const id = randomUUID();
		await db.menuItem.update({
			where: { id: pid },
			data: { stockQuantity: 0 },
		});
		await expect(partial(t.id, 3000, id)).rejects.toMatchObject({
			code: "INSUFFICIENT_STOCK",
		});
		expect(await db.billSplit.count({ where: { tabId: t.id } })).toBe(0);
		expect(await db.payment.count({ where: { tabId: t.id } })).toBe(0);
		expect(
			(await db.tab.findUniqueOrThrow({ where: { id: t.id } })).stockDebitedAt
		).toBeNull();
		await db.menuItem.update({
			where: { id: pid },
			data: { stockQuantity: 1 },
		});
		expect((await partial(t.id, 3000, id))?.remainingInCents).toBe(7000);
	}, 30_000);
	it("freezes adjusted total/items and forbids mixing with PEOPLE/ITEMS divisions", async () => {
		const t = await tab();
		const input = {
			requestId: randomUUID(),
			amountInCents: 3000,
			method: "PIX" as const,
			serviceFee: { type: "PERCENT" as const, basisPoints: 1000 },
			discount: { type: "FIXED" as const, amountInCents: 500 },
		};
		expect(
			(await registerPartialPayment(db, t.id, rid, owner, input))
				?.remainingInCents
		).toBe(7500);
		await expect(
			registerPartialPayment(db, t.id, rid, owner, {
				...input,
				requestId: randomUUID(),
				discount: { type: "FIXED", amountInCents: 0 },
			})
		).rejects.toMatchObject({ code: "BILL_SPLIT_LOCKED" });
		await expect(
			db.orderItem.update({
				where: { id: t.items[0]?.id },
				data: { quantity: 2 },
			})
		).rejects.toThrow("BILL_SPLIT_LOCKED");
		const division = {
			requestId: randomUUID(),
			mode: "PEOPLE" as const,
			people: 2,
		};
		await expect(
			previewBillSplit(db, t.id, rid, division)
		).rejects.toMatchObject({ code: "BILL_SPLIT_LOCKED" });
		await expect(
			createBillSplit(db, t.id, rid, division)
		).rejects.toMatchObject({ code: "BILL_SPLIT_LOCKED" });
		const other = await tab();
		const preview = await previewBillSplit(db, other.id, rid, division);
		const split = await createBillSplit(db, other.id, rid, {
			...division,
			previewToken: preview.fingerprint,
		});
		await expect(partial(other.id)).rejects.toMatchObject({
			code: "BILL_SPLIT_LOCKED",
		});
		const invoice = split?.invoices[0];
		if (!invoice) {
			throw new Error("Missing invoice");
		}
		await payBillInvoice(db, other.id, rid, invoice.id, owner, {
			method: "PIX",
		});
		expect((await readBillSplit(db, other.id, rid))?.remainingInCents).toBe(
			5000
		);
		await settlePartialTab(db, t.id, rid, owner, { method: "PIX" });
		expect((await readBillSplit(db, t.id, rid))?.paidInCents).toBe(10_500);
	}, 30_000);
	it("serializes a partial receipt racing the final settlement", async () => {
		const t = await tab();
		await partial(t.id);
		const results = await Promise.allSettled([
			partial(t.id, 2000),
			settlePartialTab(db, t.id, rid, owner, {
				requestId: randomUUID(),
				method: "PIX",
			}),
		]);
		expect(results[1]?.status).toBe("fulfilled");
		const state = await readBillSplit(db, t.id, rid);
		expect(state?.paidInCents).toBe(10_000);
		expect(state?.remainingInCents).toBe(0);
		expect(state?.closedAt).not.toBeNull();
		expect(
			(await db.menuItem.findUniqueOrThrow({ where: { id: pid } }))
				.stockQuantity
		).toBe(99);
		expect(
			(await db.table.findUniqueOrThrow({ where: { id: t.tableId } })).status
		).toBe("FREE");
	}, 30_000);
});
