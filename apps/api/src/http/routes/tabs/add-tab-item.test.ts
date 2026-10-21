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

function makeOpenTab(restaurantId: string, tabId = faker.string.uuid()) {
	return {
		id: tabId,
		customerName: null,
		peopleCount: null,
		openedAt: new Date(),
		closedAt: null,
		createdAt: new Date(),
		tableId: faker.string.uuid(),
		restaurantId,
	};
}

function makeMenuItem(
	restaurantId: string,
	menuItemId = faker.string.uuid(),
	isAvailable = true
) {
	return {
		id: menuItemId,
		name: "X-Burguer",
		description: null,
		priceInCents: 1500,
		imageUrl: null,
		isAvailable,
		createdAt: new Date(),
		updatedAt: new Date(),
		restaurantId,
		categoryId: faker.string.uuid(),
	};
}

function makeOrderItem(
	tabId: string,
	menuItemId: string,
	restaurantId: string
) {
	return {
		id: faker.string.uuid(),
		quantity: 2,
		notes: null,
		status: "RECEIVED" as const,
		unitPriceInCents: 1500,
		createdAt: new Date(),
		updatedAt: new Date(),
		tabId,
		menuItemId,
		restaurantId,
	};
}

describe("POST /restaurants/:slug/tabs/:tabId/items", () => {
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

	it("adds an item to an open tab as WAITER (cenário principal)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const menuItemId = faker.string.uuid();
		const tab = makeOpenTab(restaurant.id, tabId);
		const menuItem = makeMenuItem(restaurant.id, menuItemId);
		const orderItem = makeOrderItem(tabId, menuItemId, restaurant.id);

		prismaMock.tab.findUnique.mockResolvedValue(tab);
		prismaMock.menuItem.findUnique.mockResolvedValue(menuItem);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					tab: { findUnique: vi.fn().mockResolvedValue(tab) },
					orderItem: { create: vi.fn().mockResolvedValue(orderItem) },
				};
				return fn(tx);
			}
			return fn;
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId, quantity: 2, notes: "Sem cebola" },
		});

		expect(response.statusCode).toBe(201);
		const body = JSON.parse(response.body);
		expect(body).toMatchObject({
			item: {
				id: orderItem.id,
				quantity: 2,
				status: "RECEIVED",
				unitPriceInCents: menuItem.priceInCents,
				tabId,
				menuItemId,
			},
		});
	});

	it("adds an item to an open tab as MANAGER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "MANAGER");
		const tabId = faker.string.uuid();
		const menuItemId = faker.string.uuid();
		const tab = makeOpenTab(restaurant.id, tabId);
		const menuItem = makeMenuItem(restaurant.id, menuItemId);
		const orderItem = makeOrderItem(tabId, menuItemId, restaurant.id);

		prismaMock.tab.findUnique.mockResolvedValue(tab);
		prismaMock.menuItem.findUnique.mockResolvedValue(menuItem);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					tab: { findUnique: vi.fn().mockResolvedValue(tab) },
					orderItem: { create: vi.fn().mockResolvedValue(orderItem) },
				};
				return fn(tx);
			}
			return fn;
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId, quantity: 1 },
		});

		expect(response.statusCode).toBe(201);
	});

	it("adds an item without optional notes", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const menuItemId = faker.string.uuid();
		const tab = makeOpenTab(restaurant.id, tabId);
		const menuItem = makeMenuItem(restaurant.id, menuItemId);
		const orderItem = makeOrderItem(tabId, menuItemId, restaurant.id);

		prismaMock.tab.findUnique.mockResolvedValue(tab);
		prismaMock.menuItem.findUnique.mockResolvedValue(menuItem);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					tab: { findUnique: vi.fn().mockResolvedValue(tab) },
					orderItem: { create: vi.fn().mockResolvedValue(orderItem) },
				};
				return fn(tx);
			}
			return fn;
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId, quantity: 1 },
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body).item.notes).toBeNull();
	});

	it("ignores any status field sent in the body and always records RECEIVED", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const menuItemId = faker.string.uuid();
		const tab = makeOpenTab(restaurant.id, tabId);
		const menuItem = makeMenuItem(restaurant.id, menuItemId);
		const orderItem = makeOrderItem(tabId, menuItemId, restaurant.id);

		prismaMock.tab.findUnique.mockResolvedValue(tab);
		prismaMock.menuItem.findUnique.mockResolvedValue(menuItem);

		const createSpy = vi.fn().mockResolvedValue(orderItem);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					tab: { findUnique: vi.fn().mockResolvedValue(tab) },
					orderItem: { create: createSpy },
				};
				return fn(tx);
			}
			return fn;
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId, quantity: 1, status: "PREPARING" },
		});

		expect(response.statusCode).toBe(201);
		const callArgs = createSpy.mock.calls[0]?.[0] as {
			data: { status: string };
		};
		expect(callArgs.data.status).toBe("RECEIVED");
	});

	it("returns 401 UNAUTHORIZED for CASHIER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "CASHIER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${faker.string.uuid()}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId: faker.string.uuid(), quantity: 1 },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 UNAUTHORIZED for KITCHEN", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${faker.string.uuid()}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId: faker.string.uuid(), quantity: 1 },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 UNAUTHORIZED for BILLING", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "BILLING");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${faker.string.uuid()}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId: faker.string.uuid(), quantity: 1 },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "POST",
			url: `/restaurants/some-slug/tabs/${faker.string.uuid()}/items`,
			body: { menuItemId: faker.string.uuid(), quantity: 1 },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});

	it("returns 404 TAB_NOT_FOUND when tab does not exist", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		prismaMock.tab.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${faker.string.uuid()}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId: faker.string.uuid(), quantity: 1 },
		});

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_FOUND",
		});
	});

	it("returns 409 TAB_NOT_OPEN when tab is closed (cenário 2a)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.tab.findUnique.mockResolvedValue({
			...makeOpenTab(restaurant.id, tabId),
			closedAt: new Date(),
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId: faker.string.uuid(), quantity: 1 },
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_OPEN",
		});
	});

	it("returns 404 ITEM_NOT_FOUND when menu item does not exist", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.tab.findUnique.mockResolvedValue(
			makeOpenTab(restaurant.id, tabId)
		);
		prismaMock.menuItem.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId: faker.string.uuid(), quantity: 1 },
		});

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "ITEM_NOT_FOUND",
		});
	});

	it("returns 400 ITEM_UNAVAILABLE when product is unavailable (cenário 2b)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const menuItemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.tab.findUnique.mockResolvedValue(
			makeOpenTab(restaurant.id, tabId)
		);
		prismaMock.menuItem.findUnique.mockResolvedValue(
			makeMenuItem(restaurant.id, menuItemId, false)
		);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId, quantity: 1 },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "ITEM_UNAVAILABLE",
		});
	});

	it("returns 400 validation error when quantity is zero (cenário 2c)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${faker.string.uuid()}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId: faker.string.uuid(), quantity: 0 },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});

	it("returns 400 validation error when quantity is negative (cenário 2c)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${faker.string.uuid()}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId: faker.string.uuid(), quantity: -1 },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});

	it("returns 400 validation error when notes exceed 500 characters", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${faker.string.uuid()}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: {
				menuItemId: faker.string.uuid(),
				quantity: 1,
				notes: "a".repeat(501),
			},
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});

	it("concorrência: tab fechada durante transação retorna 409 e não persiste item", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const menuItemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.tab.findUnique.mockResolvedValue(
			makeOpenTab(restaurant.id, tabId)
		);
		prismaMock.menuItem.findUnique.mockResolvedValue(
			makeMenuItem(restaurant.id, menuItemId)
		);

		const createSpy = vi.fn();
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					tab: { findUnique: vi.fn().mockResolvedValue(null) },
					orderItem: { create: createSpy },
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId, quantity: 1 },
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_OPEN",
		});
		expect(createSpy).not.toHaveBeenCalled();
	});

	it("rollback: se orderItem.create falhar, tab permanece inalterada", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const menuItemId = faker.string.uuid();
		const token = signToken(app, userId);

		const tab = makeOpenTab(restaurant.id, tabId);
		prismaMock.tab.findUnique.mockResolvedValue(tab);
		prismaMock.menuItem.findUnique.mockResolvedValue(
			makeMenuItem(restaurant.id, menuItemId)
		);

		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					tab: { findUnique: vi.fn().mockResolvedValue(tab) },
					orderItem: {
						create: vi
							.fn()
							.mockRejectedValue(new Error("DB constraint violation")),
					},
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items`,
			headers: { Authorization: `Bearer ${token}` },
			body: { menuItemId, quantity: 1 },
		});

		expect(response.statusCode).toBe(500);
	});
});
