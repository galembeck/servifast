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

function makeTab(restaurantId: string, tabId = faker.string.uuid()) {
	return {
		id: tabId,
		customerName: "Família Souza",
		peopleCount: 4,
		openedAt: new Date(),
		closedAt: null,
		createdAt: new Date(),
		tableId: faker.string.uuid(),
		restaurantId,
		items: [
			{
				id: faker.string.uuid(),
				quantity: 2,
				notes: "Sem cebola",
				status: "RECEIVED",
				unitPriceInCents: 6990,
				sentToKitchenAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
				tabId,
				restaurantId,
				menuItemId: faker.string.uuid(),
				menuItem: {
					id: faker.string.uuid(),
					name: "Filé à Parmegiana",
					imageUrl: null,
				},
			},
		],
	};
}

describe("GET /restaurants/:slug/tabs/:tabId", () => {
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

	it.each([
		"OWNER",
		"MANAGER",
		"WAITER",
		"CASHIER",
		"KITCHEN",
		"BILLING",
	] as const)("retorna a comanda com os itens para %s", async (role) => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const tab = makeTab(restaurant.id);
		const token = signToken(app, userId);

		prismaMock.tab.findUnique.mockResolvedValue(tab);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/tabs/${tab.id}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			tab: {
				id: tab.id,
				items: [{ quantity: 2, menuItem: { name: "Filé à Parmegiana" } }],
			},
		});
	});

	it("só busca comandas do restaurante do usuário", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.tab.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_FOUND",
		});
		expect(prismaMock.tab.findUnique).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: tabId, restaurantId: restaurant.id },
			})
		);
	});

	it("retorna 401 INVALID_TOKEN sem autenticação", async () => {
		const response = await app.inject({
			method: "GET",
			url: `/restaurants/any-slug/tabs/${faker.string.uuid()}`,
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
		expect(prismaMock.tab.findUnique).not.toHaveBeenCalled();
	});

	it("retorna 400 quando tabId não é um UUID", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/tabs/not-a-uuid`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(400);
	});
});
