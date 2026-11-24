import { faker } from "@faker-js/faker";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { buildApp } from "@/test/helpers/build-app";
import { mockMembership } from "@/test/helpers/membership";
import { signToken } from "@/test/helpers/sign-token";
import { prismaMock, resetPrismaMocks } from "../../../test/mocks/prisma.js";

vi.mock("@/lib/prisma", async () => {
	const { prismaMock } = await import("../../../test/mocks/prisma.js");
	return { prisma: prismaMock };
});

type Role = Parameters<typeof mockMembership>[1];

describe("POST /restaurants/:slug/tabs/:tabId/close", () => {
	let app: Awaited<ReturnType<typeof buildApp>>;

	beforeAll(async () => {
		app = await buildApp();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		resetPrismaMocks();
	});

	const tabId = faker.string.uuid();
	const tableId = faker.string.uuid();
	const burgerId = faker.string.uuid();
	const sodaId = faker.string.uuid();

	// 2 × R$ 30,00 + 1 × R$ 15,50 = R$ 75,50 (cancelled items are filtered by
	// the query, so they never reach the sum).
	const TOTAL_IN_CENTS = 7550;
	const openTab = {
		closedAt: null,
		tableId,
		items: [
			{
				menuItemId: burgerId,
				quantity: 2,
				unitPriceInCents: 3000,
				status: "DELIVERED",
			},
			{
				menuItemId: sodaId,
				quantity: 1,
				unitPriceInCents: 1550,
				status: "DELIVERED",
			},
		],
	};

	interface TrackedItem {
		id: string;
		name: string;
		stockQuantity: number;
	}

	function mockTransaction({
		tabUpdatedCount = 1,
		trackedItems = [] as TrackedItem[],
		shortOf = [] as string[],
	} = {}) {
		const tx = {
			tab: {
				updateMany: vi.fn().mockResolvedValue({ count: tabUpdatedCount }),
			},
			menuItem: {
				findMany: vi.fn().mockResolvedValue(trackedItems),
				updateMany: vi
					.fn()
					.mockImplementation(({ where }: { where: { id: string } }) => ({
						count: shortOf.includes(where.id) ? 0 : 1,
					})),
			},
			payment: {
				create: vi.fn().mockImplementation(({ data }) => ({
					id: faker.string.uuid(),
					method: data.method,
					amountInCents: data.amountInCents,
					receivedInCents: data.receivedInCents,
					changeInCents: data.changeInCents,
					createdAt: new Date(),
				})),
			},
			table: { update: vi.fn().mockResolvedValue({}) },
		};

		prismaMock.$transaction.mockImplementation((fn: unknown) =>
			typeof fn === "function" ? fn(tx) : fn
		);

		return tx;
	}

	async function closeTab(role: Role, body: Record<string, unknown>) {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/close`,
			headers: { Authorization: `Bearer ${token}` },
			payload: body,
		});

		return { response, userId, restaurant };
	}

	it("closes the tab with cash, computing the change, for CASHIER", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		const tx = mockTransaction();

		const { response, userId, restaurant } = await closeTab("CASHIER", {
			method: "CASH",
			receivedInCents: 10_000,
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			payment: {
				method: "CASH",
				amountInCents: TOTAL_IN_CENTS,
				receivedInCents: 10_000,
				changeInCents: 10_000 - TOTAL_IN_CENTS,
			},
			tab: { id: tabId },
			table: { id: tableId, status: "FREE" },
		});
		expect(tx.payment.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					tabId,
					paidById: userId,
					restaurantId: restaurant.id,
				}),
			})
		);
		expect(tx.table.update).toHaveBeenCalledWith({
			where: { id: tableId },
			data: { status: "FREE", occupiedSeats: 0 },
		});
	});

	it.each([
		"CREDIT_CARD",
		"DEBIT_CARD",
		"PIX",
	])("closes the tab with %s without received amount or change", async (method) => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		mockTransaction();

		const { response } = await closeTab("CASHIER", {
			method,
			receivedInCents: 10_000,
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			payment: {
				method,
				amountInCents: TOTAL_IN_CENTS,
				receivedInCents: null,
				changeInCents: null,
			},
		});
	});

	it.each([
		"OWNER",
		"MANAGER",
	] as const)("allows %s to close a tab", async (role) => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		mockTransaction();

		const { response } = await closeTab(role, { method: "PIX" });

		expect(response.statusCode).toBe(200);
	});

	it("accepts the exact cash amount (zero change)", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		mockTransaction();

		const { response } = await closeTab("CASHIER", {
			method: "CASH",
			receivedInCents: TOTAL_IN_CENTS,
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body).payment.changeInCents).toBe(0);
	});

	it.each([
		"RECEIVED",
		"PREPARING",
		"READY",
	])("returns 409 TAB_HAS_PENDING_ITEMS when an item is %s", async (status) => {
		prismaMock.tab.findUnique.mockResolvedValue({
			...openTab,
			items: [...openTab.items, { quantity: 1, unitPriceInCents: 900, status }],
		});

		const { response } = await closeTab("CASHIER", { method: "PIX" });

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_HAS_PENDING_ITEMS",
		});
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});

	it("only closes the tab if it still has no pending items", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		const tx = mockTransaction();

		await closeTab("CASHIER", { method: "PIX" });

		expect(tx.tab.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					closedAt: null,
					items: {
						none: { status: { in: ["RECEIVED", "PREPARING", "READY"] } },
					},
				}),
			})
		);
	});

	it("decrements the stock 1:1 for every tracked product when closing (RN01/RN02)", async () => {
		prismaMock.tab.findUnique.mockResolvedValue({
			...openTab,
			items: [
				...openTab.items,
				// Same product in two rounds: summed into a single decrement.
				{
					menuItemId: burgerId,
					quantity: 1,
					unitPriceInCents: 3000,
					status: "DELIVERED",
				},
			],
		});
		const tx = mockTransaction({
			// The soda is not tracked (null stock), so findMany leaves it out.
			trackedItems: [{ id: burgerId, name: "X-Burguer", stockQuantity: 10 }],
		});

		const { response } = await closeTab("CASHIER", { method: "PIX" });

		expect(response.statusCode).toBe(200);
		expect(tx.menuItem.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: { in: [burgerId, sodaId] },
					stockQuantity: { not: null },
				},
			})
		);
		expect(tx.menuItem.updateMany).toHaveBeenCalledTimes(1);
		expect(tx.menuItem.updateMany).toHaveBeenCalledWith({
			where: { id: burgerId, stockQuantity: { gte: 3 } },
			data: { stockQuantity: { decrement: 3 } },
		});
		expect(tx.payment.create).toHaveBeenCalled();
	});

	it("only reads non-cancelled items, so cancelled ones never leave the stock", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		mockTransaction();

		await closeTab("CASHIER", { method: "PIX" });

		expect(prismaMock.tab.findUnique).toHaveBeenCalledWith(
			expect.objectContaining({
				select: expect.objectContaining({
					items: expect.objectContaining({
						where: { status: { not: "CANCELLED" } },
					}),
				}),
			})
		);
	});

	it("returns 409 INSUFFICIENT_STOCK listing the shortages and records nothing", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		const tx = mockTransaction({
			trackedItems: [
				{ id: burgerId, name: "X-Burguer", stockQuantity: 1 },
				{ id: sodaId, name: "Refrigerante", stockQuantity: 5 },
			],
			shortOf: [burgerId],
		});

		const { response } = await closeTab("CASHIER", { method: "PIX" });

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INSUFFICIENT_STOCK",
			description: "X-Burguer \u00d71",
		});
		// Thrown inside the transaction: Prisma rolls back the tab update and
		// any decrement already applied; payment and table are never touched.
		expect(tx.payment.create).not.toHaveBeenCalled();
		expect(tx.table.update).not.toHaveBeenCalled();
	});

	it("returns 400 CASH_RECEIVED_AMOUNT_REQUIRED for cash without received amount", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);

		const { response } = await closeTab("CASHIER", { method: "CASH" });

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "CASH_RECEIVED_AMOUNT_REQUIRED",
		});
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});

	it("returns 422 INSUFFICIENT_CASH_AMOUNT when cash does not cover the total", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);

		const { response } = await closeTab("CASHIER", {
			method: "CASH",
			receivedInCents: TOTAL_IN_CENTS - 1,
		});

		expect(response.statusCode).toBe(422);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INSUFFICIENT_CASH_AMOUNT",
		});
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});

	it("returns 400 Validation error for an unknown payment method", async () => {
		const { response } = await closeTab("CASHIER", { method: "VOUCHER" });

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});

	it("returns 404 TAB_NOT_FOUND when the tab does not exist", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(null);

		const { response } = await closeTab("CASHIER", { method: "PIX" });

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_FOUND",
		});
	});

	it("returns 409 TAB_NOT_OPEN when the tab is already closed", async () => {
		prismaMock.tab.findUnique.mockResolvedValue({
			...openTab,
			closedAt: new Date(),
		});

		const { response } = await closeTab("CASHIER", { method: "PIX" });

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_OPEN",
		});
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});

	it("returns 409 TAB_NOT_OPEN and records nothing when closed concurrently", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		const tx = mockTransaction({ tabUpdatedCount: 0 });

		const { response } = await closeTab("CASHIER", { method: "PIX" });

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_OPEN",
		});
		expect(tx.payment.create).not.toHaveBeenCalled();
		expect(tx.table.update).not.toHaveBeenCalled();
	});

	it.each([
		"WAITER",
		"KITCHEN",
		"BILLING",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const { response } = await closeTab(role, { method: "PIX" });

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.tab.findUnique).not.toHaveBeenCalled();
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "POST",
			url: `/restaurants/some-restaurant/tabs/${tabId}/close`,
			payload: { method: "PIX" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
	it.each([
		[{ serviceFee: { type: "FIXED", amountInCents: 500 } }, 8050, 500, 0],
		[{ serviceFee: { type: "PERCENT", basisPoints: 1000 } }, 8305, 755, 0],
		[{ discount: { type: "FIXED", amountInCents: 1000 } }, 6550, 0, 1000],
		[{ discount: { type: "PERCENT", basisPoints: 1250 } }, 6606, 0, 944],
		[
			{
				serviceFee: { type: "PERCENT", basisPoints: 1000 },
				discount: { type: "PERCENT", basisPoints: 2000 },
			},
			6795,
			755,
			1510,
		],
	])("persists adjusted payment and subtotal snapshot %j", async (adjustments, amount, fee, discount) => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		const tx = mockTransaction();
		const { response } = await closeTab("OWNER", {
			method: "PIX",
			...adjustments,
		});
		expect(response.statusCode).toBe(200);
		expect(response.json().payment.amountInCents).toBe(amount);
		expect(tx.payment.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					subtotalInCents: 7550,
					serviceFeeInCents: fee,
					discountInCents: discount,
					amountInCents: amount,
					adjustments,
				}),
			})
		);
	});
	it("rejects a negative total before changing the tab or stock", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		const { response } = await closeTab("CASHIER", {
			method: "PIX",
			discount: { type: "FIXED", amountInCents: 10_000 },
		});
		expect(response.statusCode).toBe(422);
		expect(response.json().message).toBe("INVALID_CHECKOUT_ADJUSTMENTS");
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});
	it.each([
		{ serviceFee: { type: "FIXED", amountInCents: -1 } },
		{ discount: { type: "FIXED", amountInCents: 0.5 } },
		{ discount: { type: "PERCENT", basisPoints: 10_001 } },
		{ serviceFee: { type: "PERCENT", basisPoints: 10.5 } },
		{ serviceFee: { type: "OTHER", amountInCents: 100 } },
	])("rejects invalid adjustments %j", async (adjustments) => {
		const { response } = await closeTab("CASHIER", {
			method: "PIX",
			...adjustments,
		});
		expect(response.statusCode).toBe(400);
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});
	it.each([
		"CREDIT_CARD",
		"DEBIT_CARD",
		"PIX",
	])("charges adjusted total for %s and ignores cash tender", async (method) => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		mockTransaction();
		const { response } = await closeTab("CASHIER", {
			method,
			receivedInCents: 10_000,
			serviceFee: { type: "FIXED", amountInCents: 500 },
			discount: { type: "FIXED", amountInCents: 1000 },
		});
		expect(response.statusCode).toBe(200);
		expect(response.json().payment).toMatchObject({
			amountInCents: 7050,
			receivedInCents: null,
			changeInCents: null,
		});
	});
	it("computes change from the adjusted cash total", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		mockTransaction();
		const { response } = await closeTab("CASHIER", {
			method: "CASH",
			receivedInCents: 10_000,
			serviceFee: { type: "PERCENT", basisPoints: 1000 },
		});
		expect(response.statusCode).toBe(200);
		expect(response.json().payment).toMatchObject({
			amountInCents: 8305,
			changeInCents: 1695,
		});
	});
	it("rejects cash that covers only the old subtotal", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		const { response } = await closeTab("CASHIER", {
			method: "CASH",
			receivedInCents: 7550,
			serviceFee: { type: "FIXED", amountInCents: 100 },
		});
		expect(response.statusCode).toBe(422);
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});
	it("allows a zero total with 100% discount and zero cash received", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		mockTransaction();
		const { response } = await closeTab("OWNER", {
			method: "CASH",
			receivedInCents: 0,
			discount: { type: "PERCENT", basisPoints: 10_000 },
		});
		expect(response.statusCode).toBe(200);
		expect(response.json().payment).toMatchObject({
			amountInCents: 0,
			changeInCents: 0,
		});
	});
	it("ignores a client-supplied total and computes from server items", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(openTab);
		mockTransaction();
		const { response } = await closeTab("OWNER", {
			method: "PIX",
			amountInCents: 1,
			subtotalInCents: 1,
		});
		expect(response.statusCode).toBe(200);
		expect(response.json().payment.amountInCents).toBe(7550);
	});
});
