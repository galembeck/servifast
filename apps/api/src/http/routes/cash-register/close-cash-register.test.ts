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

describe("POST /restaurants/:slug/cash-register/close", () => {
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

	const sessionId = faker.string.uuid();
	const openedAt = new Date();

	// R$ 100,00 float + R$ 50,00 supply − R$ 30,00 withdrawal + R$ 75,50 cash
	// sales = R$ 195,50 expected in the drawer.
	const CASH_SALES_IN_CENTS = 7550;
	const EXPECTED_IN_CENTS = 19_550;
	const openSession = {
		id: sessionId,
		openedAt,
		openingAmountInCents: 10_000,
		transactions: [
			{ type: "OPENING", amountInCents: 10_000 },
			{ type: "SUPPLY", amountInCents: 5000 },
			{ type: "WITHDRAWAL", amountInCents: 3000 },
		],
	};

	function mockTransaction({ sessionUpdatedCount = 1 } = {}) {
		const tx = {
			cashRegisterSession: {
				updateMany: vi.fn().mockResolvedValue({ count: sessionUpdatedCount }),
			},
			cashRegisterTransaction: {
				create: vi.fn().mockResolvedValue({}),
			},
		};

		prismaMock.$transaction.mockImplementation((fn: unknown) =>
			typeof fn === "function" ? fn(tx) : fn
		);

		return tx;
	}

	async function closeCashRegister(role: Role, body: Record<string, unknown>) {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/cash-register/close`,
			headers: { Authorization: `Bearer ${token}` },
			payload: body,
		});

		return { response, userId, restaurant };
	}

	it("closes the register with a blind count and returns the reconciliation for CASHIER", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(openSession);
		prismaMock.payment.aggregate.mockResolvedValue({
			_sum: { amountInCents: CASH_SALES_IN_CENTS },
		});
		const tx = mockTransaction();

		const { response, userId, restaurant } = await closeCashRegister(
			"CASHIER",
			{ countedAmountInCents: 19_000 }
		);

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			session: {
				id: sessionId,
				openingAmountInCents: 10_000,
				suppliesInCents: 5000,
				withdrawalsInCents: 3000,
				cashSalesInCents: CASH_SALES_IN_CENTS,
				expectedAmountInCents: EXPECTED_IN_CENTS,
				countedAmountInCents: 19_000,
				differenceInCents: 19_000 - EXPECTED_IN_CENTS,
			},
		});
		expect(tx.cashRegisterSession.updateMany).toHaveBeenCalledWith({
			where: { id: sessionId, closedAt: null },
			data: expect.objectContaining({
				closedById: userId,
				countedAmountInCents: 19_000,
				expectedAmountInCents: EXPECTED_IN_CENTS,
				differenceInCents: 19_000 - EXPECTED_IN_CENTS,
			}),
		});
		expect(tx.cashRegisterTransaction.create).toHaveBeenCalledWith({
			data: {
				type: "CLOSING",
				amountInCents: 19_000,
				sessionId,
				operatorId: userId,
				restaurantId: restaurant.id,
			},
		});
	});

	it("reports a positive difference when there is more cash than expected", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(openSession);
		prismaMock.payment.aggregate.mockResolvedValue({
			_sum: { amountInCents: null },
		});
		mockTransaction();

		const { response } = await closeCashRegister("CASHIER", {
			countedAmountInCents: 12_500,
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body).session).toMatchObject({
			cashSalesInCents: 0,
			expectedAmountInCents: 12_000,
			differenceInCents: 500,
		});
	});

	it.each([
		"OWNER",
		"MANAGER",
	] as const)("allows %s to close the register", async (role) => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(openSession);
		prismaMock.payment.aggregate.mockResolvedValue({
			_sum: { amountInCents: 0 },
		});
		mockTransaction();

		const { response } = await closeCashRegister(role, {
			countedAmountInCents: 12_000,
		});

		expect(response.statusCode).toBe(200);
	});

	it("returns 409 CASH_REGISTER_NOT_OPEN when there is no open register", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(null);

		const { response } = await closeCashRegister("CASHIER", {
			countedAmountInCents: 1000,
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "CASH_REGISTER_NOT_OPEN",
		});
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});

	it("returns 409 CASH_REGISTER_NOT_OPEN and records no CLOSING when closed concurrently", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(openSession);
		prismaMock.payment.aggregate.mockResolvedValue({
			_sum: { amountInCents: 0 },
		});
		const tx = mockTransaction({ sessionUpdatedCount: 0 });

		const { response } = await closeCashRegister("CASHIER", {
			countedAmountInCents: 12_000,
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "CASH_REGISTER_NOT_OPEN",
		});
		expect(tx.cashRegisterTransaction.create).not.toHaveBeenCalled();
	});

	it.each([
		{ countedAmountInCents: -1 },
		{ countedAmountInCents: 99.9 },
		{},
	])("returns 400 for an invalid counted amount (%o)", async (body) => {
		const { response } = await closeCashRegister("CASHIER", body);

		expect(response.statusCode).toBe(400);
		expect(prismaMock.cashRegisterSession.findFirst).not.toHaveBeenCalled();
	});

	it.each([
		"WAITER",
		"KITCHEN",
		"BILLING",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const { response } = await closeCashRegister(role, {
			countedAmountInCents: 1000,
		});

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.cashRegisterSession.findFirst).not.toHaveBeenCalled();
	});

	it("returns 401 INVALID_TOKEN without an Authorization header", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/restaurants/test-restaurant/cash-register/close",
			payload: { countedAmountInCents: 1000 },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
