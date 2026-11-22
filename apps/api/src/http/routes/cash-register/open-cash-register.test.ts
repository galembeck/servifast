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

describe("POST /restaurants/:slug/cash-register/open", () => {
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

	function mockTransaction() {
		const tx = {
			cashRegisterSession: {
				create: vi.fn().mockImplementation(({ data }) => ({
					id: sessionId,
					openingAmountInCents: data.openingAmountInCents,
					openedAt: new Date(),
				})),
			},
			cashRegisterTransaction: {
				create: vi.fn().mockImplementation(({ data }) => ({
					id: faker.string.uuid(),
					type: data.type,
					amountInCents: data.amountInCents,
					operatorId: data.operatorId,
					createdAt: new Date(),
				})),
			},
		};

		prismaMock.$transaction.mockImplementation((fn: unknown) =>
			typeof fn === "function" ? fn(tx) : fn
		);

		return tx;
	}

	async function openCashRegister(role: Role, body: Record<string, unknown>) {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/cash-register/open`,
			headers: { Authorization: `Bearer ${token}` },
			payload: body,
		});

		return { response, userId, restaurant };
	}

	it("opens the cash register with the opening float and records an OPENING movement for CASHIER", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(null);
		const tx = mockTransaction();

		const { response, userId, restaurant } = await openCashRegister("CASHIER", {
			openingAmountInCents: 20_000,
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body)).toMatchObject({
			session: { id: sessionId, openingAmountInCents: 20_000 },
			transaction: {
				type: "OPENING",
				amountInCents: 20_000,
				operatorId: userId,
			},
		});
		expect(tx.cashRegisterSession.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: {
					openingAmountInCents: 20_000,
					openedById: userId,
					restaurantId: restaurant.id,
				},
			})
		);
		expect(tx.cashRegisterTransaction.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: {
					type: "OPENING",
					amountInCents: 20_000,
					sessionId,
					operatorId: userId,
					restaurantId: restaurant.id,
				},
			})
		);
	});

	it("accepts a zero opening float", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(null);
		mockTransaction();

		const { response } = await openCashRegister("CASHIER", {
			openingAmountInCents: 0,
		});

		expect(response.statusCode).toBe(201);
	});

	it.each([
		"OWNER",
		"MANAGER",
	] as const)("allows %s to open the cash register", async (role) => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(null);
		mockTransaction();

		const { response } = await openCashRegister(role, {
			openingAmountInCents: 1000,
		});

		expect(response.statusCode).toBe(201);
	});

	it("returns 409 CASH_REGISTER_ALREADY_OPEN when a register is already open", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue({
			id: faker.string.uuid(),
		});

		const { response } = await openCashRegister("CASHIER", {
			openingAmountInCents: 1000,
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "CASH_REGISTER_ALREADY_OPEN",
		});
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});

	it("returns 409 CASH_REGISTER_ALREADY_OPEN when another register is opened concurrently", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(null);
		prismaMock.$transaction.mockRejectedValue(
			Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
		);

		const { response } = await openCashRegister("CASHIER", {
			openingAmountInCents: 1000,
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "CASH_REGISTER_ALREADY_OPEN",
		});
	});

	it.each([
		{ openingAmountInCents: -1 },
		{ openingAmountInCents: 10.5 },
		{},
	])("returns 400 for an invalid opening float (%o)", async (body) => {
		const { response } = await openCashRegister("CASHIER", body);

		expect(response.statusCode).toBe(400);
		expect(prismaMock.cashRegisterSession.findFirst).not.toHaveBeenCalled();
	});

	it.each([
		"WAITER",
		"KITCHEN",
		"BILLING",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const { response } = await openCashRegister(role, {
			openingAmountInCents: 1000,
		});

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.cashRegisterSession.findFirst).not.toHaveBeenCalled();
	});

	it("returns 401 INVALID_TOKEN without an Authorization header", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/restaurants/test-restaurant/cash-register/open",
			payload: { openingAmountInCents: 1000 },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
