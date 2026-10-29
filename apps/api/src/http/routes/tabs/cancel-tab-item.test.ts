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

function makeOrderItemWithTab(
	restaurantId: string,
	tabId: string,
	itemId = faker.string.uuid(),
	status: "RECEIVED" | "CANCELLED" = "RECEIVED",
	tabClosedAt: Date | null = null,
	sentToKitchenAt: Date | null = null
) {
	return {
		id: itemId,
		quantity: 2,
		notes: null,
		status,
		sentToKitchenAt,
		unitPriceInCents: 1500,
		createdAt: new Date(),
		updatedAt: new Date(),
		tabId,
		menuItemId: faker.string.uuid(),
		restaurantId,
		tab: { closedAt: tabClosedAt },
	};
}

function makeCancelledItem(
	restaurantId: string,
	tabId: string,
	itemId: string
) {
	return {
		id: itemId,
		quantity: 2,
		notes: null,
		status: "CANCELLED" as const,
		unitPriceInCents: 1500,
		createdAt: new Date(),
		updatedAt: new Date(),
		tabId,
		menuItemId: faker.string.uuid(),
		restaurantId,
	};
}

describe("PATCH /restaurants/:slug/tabs/:tabId/items/:itemId/cancel", () => {
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

	it("cancela item RECEIVED como WAITER (cenário principal)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		const orderItem = makeOrderItemWithTab(restaurant.id, tabId, itemId);
		const cancelledItem = makeCancelledItem(restaurant.id, tabId, itemId);

		prismaMock.orderItem.findUnique.mockResolvedValue(orderItem);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
						findUnique: vi.fn().mockResolvedValue(cancelledItem),
					},
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body).toMatchObject({
			item: {
				id: itemId,
				status: "CANCELLED",
			},
		});
	});

	it("cancela item RECEIVED como MANAGER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "MANAGER");
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		const orderItem = makeOrderItemWithTab(restaurant.id, tabId, itemId);
		const cancelledItem = makeCancelledItem(restaurant.id, tabId, itemId);

		prismaMock.orderItem.findUnique.mockResolvedValue(orderItem);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
						findUnique: vi.fn().mockResolvedValue(cancelledItem),
					},
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
	});

	it("cancela item RECEIVED como CASHIER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "CASHIER");
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		const orderItem = makeOrderItemWithTab(restaurant.id, tabId, itemId);
		const cancelledItem = makeCancelledItem(restaurant.id, tabId, itemId);

		prismaMock.orderItem.findUnique.mockResolvedValue(orderItem);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
						findUnique: vi.fn().mockResolvedValue(cancelledItem),
					},
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
	});

	it("cancela item RECEIVED como KITCHEN", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		const orderItem = makeOrderItemWithTab(restaurant.id, tabId, itemId);
		const cancelledItem = makeCancelledItem(restaurant.id, tabId, itemId);

		prismaMock.orderItem.findUnique.mockResolvedValue(orderItem);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
						findUnique: vi.fn().mockResolvedValue(cancelledItem),
					},
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
	});

	it("retorna 403 FORBIDDEN para BILLING", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "BILLING");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${faker.string.uuid()}/items/${faker.string.uuid()}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "FORBIDDEN",
		});
	});

	it("retorna 401 INVALID_TOKEN sem autenticação", async () => {
		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/some-slug/tabs/${faker.string.uuid()}/items/${faker.string.uuid()}/cancel`,
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});

	it("retorna 404 ORDER_ITEM_NOT_FOUND quando item não existe (cenário 2c)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		prismaMock.orderItem.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${faker.string.uuid()}/items/${faker.string.uuid()}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "ORDER_ITEM_NOT_FOUND",
		});
	});

	it("retorna 409 TAB_NOT_OPEN quando comanda está fechada", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeOrderItemWithTab(restaurant.id, tabId, itemId, "RECEIVED", new Date())
		);

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_OPEN",
		});
	});

	it("retorna 409 ORDER_ITEM_NOT_CANCELLABLE quando item já está CANCELLED (cenário 2b)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeOrderItemWithTab(restaurant.id, tabId, itemId, "CANCELLED")
		);

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "ORDER_ITEM_NOT_CANCELLABLE",
		});
	});

	it("concorrência: updateMany count=0 retorna 409 ORDER_ITEM_NOT_CANCELLABLE (cenário 2a)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeOrderItemWithTab(restaurant.id, tabId, itemId)
		);

		const findUniqueSpy = vi.fn();
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						updateMany: vi.fn().mockResolvedValue({ count: 0 }),
						findUnique: findUniqueSpy,
					},
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "ORDER_ITEM_NOT_CANCELLABLE",
		});
		expect(findUniqueSpy).not.toHaveBeenCalled();
	});

	it("rollback: se findUnique falhar após atualização, retorna 500", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeOrderItemWithTab(restaurant.id, tabId, itemId)
		);

		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						updateMany: vi.fn().mockResolvedValue({ count: 1 }),
						findUnique: vi
							.fn()
							.mockRejectedValue(new Error("DB constraint violation")),
					},
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(500);
	});

	it("retorna 409 ORDER_ITEM_ALREADY_SENT_TO_KITCHEN quando item já foi enviado para a cozinha", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		const sentItem = makeOrderItemWithTab(
			restaurant.id,
			tabId,
			itemId,
			"RECEIVED",
			null,
			new Date()
		);

		prismaMock.orderItem.findUnique.mockResolvedValue(sentItem);

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "ORDER_ITEM_ALREADY_SENT_TO_KITCHEN",
		});
	});

	it.each([
		"OWNER",
		"MANAGER",
	] as const)("%s força o cancelamento de item já enviado para a cozinha", async (role) => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeOrderItemWithTab(
				restaurant.id,
				tabId,
				itemId,
				"RECEIVED",
				null,
				new Date()
			)
		);
		const updateMany = vi.fn().mockResolvedValue({ count: 1 });
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					orderItem: {
						updateMany,
						findUnique: vi
							.fn()
							.mockResolvedValue(
								makeCancelledItem(restaurant.id, tabId, itemId)
							),
					},
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
			payload: { force: true },
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			item: { status: "CANCELLED" },
			forced: true,
		});
		expect(updateMany).toHaveBeenCalledWith({
			where: { id: itemId, status: "RECEIVED" },
			data: { status: "CANCELLED" },
		});
	});

	it.each([
		"WAITER",
		"CASHIER",
		"KITCHEN",
	] as const)("retorna 403 FORBIDDEN quando %s tenta forçar cancelamento", async (role) => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeOrderItemWithTab(
				restaurant.id,
				tabId,
				itemId,
				"RECEIVED",
				null,
				new Date()
			)
		);

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
			payload: { force: true },
		});

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});

	it("cancelamento normal não pode ser concluído se o item for enviado à cozinha no meio do caminho", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tabId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeOrderItemWithTab(restaurant.id, tabId, itemId)
		);
		const updateMany = vi.fn().mockResolvedValue({ count: 0 });
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				return fn({ orderItem: { updateMany, findUnique: vi.fn() } });
			}
			return fn;
		});

		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/cancel`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(409);
		expect(updateMany).toHaveBeenCalledWith({
			where: { id: itemId, status: "RECEIVED", sentToKitchenAt: null },
			data: { status: "CANCELLED" },
		});
	});
});
