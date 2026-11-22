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

describe("GET /restaurants/:slug/cash-register", () => {
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

	async function getCashRegister(role: Role) {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/cash-register`,
			headers: { Authorization: `Bearer ${token}` },
		});

		return { response, userId, restaurant };
	}

	it("returns the open session without exposing the expected balance", async () => {
		const session = {
			id: faker.string.uuid(),
			openingAmountInCents: 20_000,
			openedAt: new Date(),
			openedBy: { id: faker.string.uuid(), name: "Ana Caixa" },
		};
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(session);

		const { response, restaurant } = await getCashRegister("CASHIER");

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body).toMatchObject({
			session: {
				id: session.id,
				openingAmountInCents: 20_000,
				openedBy: session.openedBy,
			},
		});
		expect(body.session).not.toHaveProperty("expectedAmountInCents");
		expect(prismaMock.cashRegisterSession.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { restaurantId: restaurant.id, closedAt: null },
			})
		);
	});

	it("returns null when the register is closed", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(null);

		const { response } = await getCashRegister("MANAGER");

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toEqual({ session: null });
	});

	it("allows OWNER to view the register", async () => {
		prismaMock.cashRegisterSession.findFirst.mockResolvedValue(null);

		const { response } = await getCashRegister("OWNER");

		expect(response.statusCode).toBe(200);
	});

	it.each([
		"WAITER",
		"KITCHEN",
		"BILLING",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const { response } = await getCashRegister(role);

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
	});

	it("returns 401 INVALID_TOKEN without an Authorization header", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/restaurants/test-restaurant/cash-register",
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
