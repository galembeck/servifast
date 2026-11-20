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

describe("GET /restaurants/:slug/cash-register/transactions", () => {
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

	const operator = { id: faker.string.uuid(), name: "Ana Caixa" };

	function buildSession(overrides: Record<string, unknown> = {}) {
		return {
			id: faker.string.uuid(),
			openedAt: new Date(),
			closedAt: null,
			openingAmountInCents: 10_000,
			countedAmountInCents: null,
			expectedAmountInCents: null,
			differenceInCents: null,
			transactions: [
				{
					id: faker.string.uuid(),
					type: "OPENING",
					amountInCents: 10_000,
					description: null,
					createdAt: new Date(),
					operator,
				},
				{
					id: faker.string.uuid(),
					type: "WITHDRAWAL",
					amountInCents: 3000,
					description: "Depósito no banco",
					createdAt: new Date(),
					operator,
				},
			],
			...overrides,
		};
	}

	async function getTransactions(role: Role, query = "") {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/cash-register/transactions${query}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		return { response, userId, restaurant };
	}

	it("lists the open session's movements with their operator", async () => {
		const session = buildSession();
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(session);

		const { response, restaurant } = await getTransactions("CASHIER");

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body.session).toMatchObject({
			id: session.id,
			closedAt: null,
			expectedAmountInCents: null,
		});
		expect(body.transactions).toHaveLength(2);
		expect(body.transactions[1]).toMatchObject({
			type: "WITHDRAWAL",
			amountInCents: 3000,
			description: "Depósito no banco",
			operator,
		});
		expect(prismaMock.cashRegisterSession.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { restaurantId: restaurant.id, closedAt: null },
			})
		);
	});

	it("returns an empty list when the register is closed and no session is given", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(null);

		const { response } = await getTransactions("CASHIER");

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toEqual({
			session: null,
			transactions: [],
		});
	});

	it("returns a past session with its reconciliation when sessionId is given", async () => {
		const session = buildSession({
			closedAt: new Date(),
			countedAmountInCents: 6900,
			expectedAmountInCents: 7000,
			differenceInCents: -100,
		});
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(session);

		const { response, restaurant } = await getTransactions(
			"MANAGER",
			`?sessionId=${session.id}`
		);

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body).session).toMatchObject({
			id: session.id,
			expectedAmountInCents: 7000,
			differenceInCents: -100,
		});
		expect(prismaMock.cashRegisterSession.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: session.id, restaurantId: restaurant.id },
			})
		);
	});

	it("returns 404 CASH_REGISTER_SESSION_NOT_FOUND for an unknown sessionId", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(null);

		const { response } = await getTransactions(
			"CASHIER",
			`?sessionId=${faker.string.uuid()}`
		);

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "CASH_REGISTER_SESSION_NOT_FOUND",
		});
	});

	it("returns 400 for a malformed sessionId", async () => {
		const { response } = await getTransactions("CASHIER", "?sessionId=abc");

		expect(response.statusCode).toBe(400);
	});

	it.each([
		"WAITER",
		"KITCHEN",
		"BILLING",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const { response } = await getTransactions(role);

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
	});

	it("returns 401 INVALID_TOKEN without an Authorization header", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/restaurants/test-restaurant/cash-register/transactions",
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
