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

describe("POST /restaurants/:slug/cash-register/transactions", () => {
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

	// Drawer: R$ 100,00 float + R$ 50,00 supply − R$ 30,00 withdrawal = R$ 120,00,
	// plus cash sales mocked per test.
	const openSession = {
		id: sessionId,
		openedAt,
		transactions: [
			{ type: "OPENING", amountInCents: 10_000 },
			{ type: "SUPPLY", amountInCents: 5000 },
			{ type: "WITHDRAWAL", amountInCents: 3000 },
		],
	};
	const DRAWER_WITHOUT_SALES = 12_000;

	function mockCreate() {
		prismaMock.cashRegisterTransaction.create.mockImplementation(
			({ data }) => ({
				id: faker.string.uuid(),
				amountInCents: data.amountInCents,
				description: data.description,
				operatorId: data.operatorId,
				sessionId: data.sessionId,
				createdAt: new Date(),
			})
		);
	}

	function mockCashSales(amountInCents: number | null) {
		prismaMock.payment.aggregate.mockResolvedValue({
			_sum: { amountInCents },
		});
	}

	async function createTransaction(role: Role, body: Record<string, unknown>) {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/cash-register/transactions`,
			headers: { Authorization: `Bearer ${token}` },
			payload: body,
		});

		return { response, userId, restaurant };
	}

	it("records a supply attributed to the operator for CASHIER", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(openSession);
		mockCreate();

		const { response, userId, restaurant } = await createTransaction(
			"CASHIER",
			{ type: "SUPPLY", amountInCents: 2500, description: "  Troco extra  " }
		);

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body)).toMatchObject({
			transaction: {
				type: "SUPPLY",
				amountInCents: 2500,
				description: "Troco extra",
				operatorId: userId,
				sessionId,
			},
		});
		expect(prismaMock.cashRegisterTransaction.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: {
					type: "SUPPLY",
					amountInCents: 2500,
					description: "Troco extra",
					sessionId,
					operatorId: userId,
					restaurantId: restaurant.id,
				},
			})
		);
		// Supplies never need the drawer balance.
		expect(prismaMock.payment.aggregate).not.toHaveBeenCalled();
	});

	it("stores an empty description as null", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(openSession);
		mockCreate();

		const { response } = await createTransaction("CASHIER", {
			type: "SUPPLY",
			amountInCents: 100,
			description: "   ",
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body).transaction.description).toBeNull();
	});

	it("records a withdrawal that the drawer (including cash sales) can cover", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(openSession);
		mockCashSales(7550);
		mockCreate();

		const { response, restaurant } = await createTransaction("CASHIER", {
			type: "WITHDRAWAL",
			amountInCents: DRAWER_WITHOUT_SALES + 7550,
			description: "Depósito no banco",
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body).transaction.type).toBe("WITHDRAWAL");
		expect(prismaMock.payment.aggregate).toHaveBeenCalledWith({
			where: {
				restaurantId: restaurant.id,
				method: "CASH",
				createdAt: { gte: openedAt },
			},
			_sum: { amountInCents: true },
		});
	});

	it("returns 422 INSUFFICIENT_CASH_BALANCE when the withdrawal exceeds the drawer", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(openSession);
		mockCashSales(null);

		const { response } = await createTransaction("CASHIER", {
			type: "WITHDRAWAL",
			amountInCents: DRAWER_WITHOUT_SALES + 1,
		});

		expect(response.statusCode).toBe(422);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INSUFFICIENT_CASH_BALANCE",
		});
		expect(prismaMock.cashRegisterTransaction.create).not.toHaveBeenCalled();
	});

	it("returns 409 CASH_REGISTER_NOT_OPEN when the register is closed", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(null);

		const { response } = await createTransaction("CASHIER", {
			type: "SUPPLY",
			amountInCents: 1000,
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "CASH_REGISTER_NOT_OPEN",
		});
		expect(prismaMock.cashRegisterTransaction.create).not.toHaveBeenCalled();
	});

	it.each([
		{ type: "OPENING", amountInCents: 1000 },
		{ type: "CLOSING", amountInCents: 1000 },
		{ type: "SUPPLY", amountInCents: 0 },
		{ type: "WITHDRAWAL", amountInCents: -500 },
		{ type: "SUPPLY", amountInCents: 10.5 },
		{ type: "SUPPLY", amountInCents: 1000, description: "x".repeat(201) },
	])("returns 400 for an invalid movement (%o)", async (body) => {
		const { response } = await createTransaction("CASHIER", body);

		expect(response.statusCode).toBe(400);
		expect(prismaMock.cashRegisterSession.findFirst).not.toHaveBeenCalled();
	});

	it.each([
		"OWNER",
		"MANAGER",
	] as const)("allows %s to record movements", async (role) => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(openSession);
		mockCreate();

		const { response } = await createTransaction(role, {
			type: "SUPPLY",
			amountInCents: 1000,
		});

		expect(response.statusCode).toBe(201);
	});

	it.each([
		"WAITER",
		"KITCHEN",
		"BILLING",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const { response } = await createTransaction(role, {
			type: "SUPPLY",
			amountInCents: 1000,
		});

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.cashRegisterTransaction.create).not.toHaveBeenCalled();
	});

	it("returns 401 INVALID_TOKEN without an Authorization header", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/restaurants/test-restaurant/cash-register/transactions",
			payload: { type: "SUPPLY", amountInCents: 1000 },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
