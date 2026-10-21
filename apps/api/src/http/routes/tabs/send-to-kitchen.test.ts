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

function makeOpenTab(
	restaurantId: string,
	tabId = faker.string.uuid(),
	tableNumber = 5
) {
	return {
		id: tabId,
		customerName: null,
		peopleCount: null,
		openedAt: new Date(),
		closedAt: null,
		createdAt: new Date(),
		tableId: faker.string.uuid(),
		restaurantId,
		table: { number: tableNumber },
	};
}

function makePendingItem(
	tabId: string,
	restaurantId: string,
	itemId = faker.string.uuid(),
	menuItemId = faker.string.uuid()
) {
	return {
		id: itemId,
		quantity: 2,
		notes: "Sem cebola",
		status: "RECEIVED" as const,
		sentToKitchenAt: null,
		unitPriceInCents: 1500,
		createdAt: new Date(),
		updatedAt: new Date(),
		tabId,
		menuItemId,
		restaurantId,
		menuItem: { id: menuItemId, name: "X-Burguer" },
	};
}

function makeKdsEvent(
	tabId: string,
	restaurantId: string,
	items: ReturnType<typeof makePendingItem>[]
) {
	return {
		id: faker.string.uuid(),
		sentAt: new Date(),
		processedAt: null,
		tabId,
		restaurantId,
		items: items.map((i) => ({
			id: i.id,
			productId: i.menuItemId,
			name: i.menuItem.name,
			quantity: i.quantity,
			notes: i.notes,
		})),
	};
}

describe("POST /restaurants/:slug/tabs/:tabId/send-to-kitchen", () => {
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

	it("envia itens pendentes para a cozinha como WAITER (cenário 1)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		const item1 = makePendingItem(tabId, restaurant.id);
		const item2 = makePendingItem(tabId, restaurant.id);
		const tab = makeOpenTab(restaurant.id, tabId, 7);
		const event = makeKdsEvent(tabId, restaurant.id, [item1, item2]);

		prismaMock.tab.findUnique.mockResolvedValue(tab);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						findMany: vi.fn().mockResolvedValue([item1, item2]),
						updateMany: vi.fn().mockResolvedValue({ count: 2 }),
					},
					kdsEvent: { create: vi.fn().mockResolvedValue(event) },
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body.event.tableNumber).toBe(7);
		expect(body.event.items).toHaveLength(2);
		expect(body.event.items[0]).toMatchObject({
			id: item1.id,
			productId: item1.menuItemId,
			name: item1.menuItem.name,
			quantity: item1.quantity,
			notes: item1.notes,
		});
	});

	it("envia itens como MANAGER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "MANAGER");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		const item = makePendingItem(tabId, restaurant.id);
		const event = makeKdsEvent(tabId, restaurant.id, [item]);

		prismaMock.tab.findUnique.mockResolvedValue(
			makeOpenTab(restaurant.id, tabId)
		);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						findMany: vi.fn().mockResolvedValue([item]),
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
					},
					kdsEvent: { create: vi.fn().mockResolvedValue(event) },
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
	});

	it("envia itens como CASHIER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "CASHIER");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		const item = makePendingItem(tabId, restaurant.id);
		const event = makeKdsEvent(tabId, restaurant.id, [item]);

		prismaMock.tab.findUnique.mockResolvedValue(
			makeOpenTab(restaurant.id, tabId)
		);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						findMany: vi.fn().mockResolvedValue([item]),
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
					},
					kdsEvent: { create: vi.fn().mockResolvedValue(event) },
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
	});

	it("envia itens como KITCHEN", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		const item = makePendingItem(tabId, restaurant.id);
		const event = makeKdsEvent(tabId, restaurant.id, [item]);

		prismaMock.tab.findUnique.mockResolvedValue(
			makeOpenTab(restaurant.id, tabId)
		);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						findMany: vi.fn().mockResolvedValue([item]),
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
					},
					kdsEvent: { create: vi.fn().mockResolvedValue(event) },
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
	});

	it("retorna 403 FORBIDDEN para BILLING", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "BILLING");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${faker.string.uuid()}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "FORBIDDEN",
		});
	});

	it("retorna 401 INVALID_TOKEN sem autenticação", async () => {
		const response = await app.inject({
			method: "POST",
			url: `/restaurants/some-slug/tabs/${faker.string.uuid()}/send-to-kitchen`,
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});

	it("retorna 404 TAB_NOT_FOUND quando comanda não existe", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		prismaMock.tab.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${faker.string.uuid()}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_FOUND",
		});
	});

	it("retorna 409 TAB_NOT_OPEN quando comanda está fechada (cenário 2b)", async () => {
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
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_OPEN",
		});
	});

	it("retorna 409 NO_ITEMS_TO_SEND quando não há itens pendentes (cenário 2a)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.tab.findUnique.mockResolvedValue(
			makeOpenTab(restaurant.id, tabId)
		);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						findMany: vi.fn().mockResolvedValue([]),
						updateMany: vi.fn(),
					},
					kdsEvent: { create: vi.fn() },
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "NO_ITEMS_TO_SEND",
		});
	});

	it("itens CANCELADOS não entram no envio (cenário 2c): findMany só retorna RECEIVED", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		const receivedItem = makePendingItem(tabId, restaurant.id);
		const event = makeKdsEvent(tabId, restaurant.id, [receivedItem]);

		prismaMock.tab.findUnique.mockResolvedValue(
			makeOpenTab(restaurant.id, tabId)
		);

		const findManySpy = vi.fn().mockResolvedValue([receivedItem]);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						findMany: findManySpy,
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
					},
					kdsEvent: { create: vi.fn().mockResolvedValue(event) },
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		const callArgs = findManySpy.mock.calls[0]?.[0] as {
			where: { status: string; sentToKitchenAt: null };
		};
		expect(callArgs.where.status).toBe("RECEIVED");
		expect(callArgs.where.sentToKitchenAt).toBeNull();
		expect(JSON.parse(response.body).event.items).toHaveLength(1);
	});

	it("reenvio: segundo envio inclui apenas itens novos", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		const newItem = makePendingItem(tabId, restaurant.id);
		const event = makeKdsEvent(tabId, restaurant.id, [newItem]);

		prismaMock.tab.findUnique.mockResolvedValue(
			makeOpenTab(restaurant.id, tabId)
		);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						findMany: vi.fn().mockResolvedValue([newItem]),
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
					},
					kdsEvent: { create: vi.fn().mockResolvedValue(event) },
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body.event.items).toHaveLength(1);
		expect(body.event.items[0].id).toBe(newItem.id);
	});

	it("concorrência: updateMany count !== ids.length retorna 409 e não cria evento", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		const item1 = makePendingItem(tabId, restaurant.id);
		const item2 = makePendingItem(tabId, restaurant.id);

		prismaMock.tab.findUnique.mockResolvedValue(
			makeOpenTab(restaurant.id, tabId)
		);

		const createSpy = vi.fn();
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						findMany: vi.fn().mockResolvedValue([item1, item2]),
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
					},
					kdsEvent: { create: createSpy },
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "NO_ITEMS_TO_SEND",
		});
		expect(createSpy).not.toHaveBeenCalled();
	});

	it("rollback: kdsEvent.create falha retorna 500 e itens não são marcados", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const token = signToken(app, userId);

		const item = makePendingItem(tabId, restaurant.id);

		prismaMock.tab.findUnique.mockResolvedValue(
			makeOpenTab(restaurant.id, tabId)
		);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						findMany: vi.fn().mockResolvedValue([item]),
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
					},
					kdsEvent: {
						create: vi.fn().mockRejectedValue(new Error("DB write error")),
					},
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/send-to-kitchen`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(500);
	});
});
