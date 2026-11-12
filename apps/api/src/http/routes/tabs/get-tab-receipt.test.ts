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

describe("GET /restaurants/:slug/tabs/:tabId/receipt", () => {
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
	const paymentId = "a1b2c3d4-0000-4000-8000-000000000000";
	const pizza = { id: faker.string.uuid(), name: "Pizza Margherita" };
	const soda = { id: faker.string.uuid(), name: "Refrigerante Lata" };

	function makeClosedTab(overrides: Record<string, unknown> = {}) {
		return {
			customerName: "Juliana",
			peopleCount: 3,
			openedAt: new Date(),
			closedAt: new Date(),
			table: { number: 8 },
			items: [
				{ quantity: 1, unitPriceInCents: 5990, menuItem: pizza },
				{ quantity: 2, unitPriceInCents: 700, menuItem: soda },
				{ quantity: 1, unitPriceInCents: 5990, menuItem: pizza },
			],
			payment: {
				id: paymentId,
				method: "CASH",
				amountInCents: 13_380,
				receivedInCents: 15_000,
				changeInCents: 1620,
				createdAt: new Date(),
				paidBy: { name: "Carla Caixa" },
			},
			...overrides,
		};
	}

	function getReceipt(role: Role) {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		return app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/receipt`,
			headers: { Authorization: `Bearer ${token}` },
		});
	}

	it("returns the structured receipt of a closed tab for CASHIER", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(makeClosedTab());

		const response = await getReceipt("CASHIER");

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			receipt: {
				code: "A1B2C3D4",
				restaurant: { name: "Test Restaurant" },
				table: { number: 8 },
				tab: { customerName: "Juliana", peopleCount: 3 },
				items: [
					{ name: pizza.name, quantity: 2, totalInCents: 11_980 },
					{ name: soda.name, quantity: 2, totalInCents: 1400 },
				],
				subtotalInCents: 13_380,
				payment: {
					method: "CASH",
					amountInCents: 13_380,
					receivedInCents: 15_000,
					changeInCents: 1620,
					cashierName: "Carla Caixa",
				},
			},
		});
	});

	it("excludes cancelled items when loading the tab", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(makeClosedTab());

		await getReceipt("CASHIER");

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

	it.each([
		"OWNER",
		"MANAGER",
	] as const)("allows %s to issue a receipt", async (role) => {
		prismaMock.tab.findUnique.mockResolvedValue(makeClosedTab());

		const response = await getReceipt(role);

		expect(response.statusCode).toBe(200);
	});

	it("returns 409 TAB_NOT_CLOSED for an open tab", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(
			makeClosedTab({ closedAt: null, payment: null })
		);

		const response = await getReceipt("CASHIER");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_CLOSED",
		});
	});

	it("returns 409 TAB_NOT_CLOSED for a closed tab without payment", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(
			makeClosedTab({ payment: null })
		);

		const response = await getReceipt("CASHIER");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_CLOSED",
		});
	});

	it("returns 404 TAB_NOT_FOUND when the tab does not exist", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(null);

		const response = await getReceipt("CASHIER");

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_FOUND",
		});
	});

	it.each([
		"WAITER",
		"KITCHEN",
		"BILLING",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const response = await getReceipt(role);

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.tab.findUnique).not.toHaveBeenCalled();
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "GET",
			url: `/restaurants/some-restaurant/tabs/${tabId}/receipt`,
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
