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

type Role = "OWNER" | "MANAGER" | "WAITER" | "CASHIER" | "KITCHEN" | "BILLING";
type ItemStatus =
	| "RECEIVED"
	| "PREPARING"
	| "READY"
	| "DELIVERED"
	| "CANCELLED";

function makeItem(
	status: ItemStatus = "READY",
	tabClosedAt: Date | null = null
) {
	return { status, tab: { closedAt: tabClosedAt } };
}

describe("PATCH /restaurants/:slug/tabs/:tabId/items/:itemId/deliver", () => {
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

	function deliver(
		role: Role,
		{
			tabId = faker.string.uuid(),
			itemId = faker.string.uuid(),
		}: { tabId?: string; itemId?: string } = {}
	) {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		return app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/items/${itemId}/deliver`,
			headers: { Authorization: `Bearer ${token}` },
		});
	}

	it("marca item PRONTO como ENTREGUE e registra a data/hora (cenário principal)", async () => {
		const itemId = faker.string.uuid();
		prismaMock.orderItem.findUnique.mockResolvedValue(makeItem("READY"));
		prismaMock.orderItem.updateMany.mockResolvedValue({ count: 1 });

		const before = Date.now();
		const response = await deliver("WAITER", { itemId });

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body.item).toMatchObject({ id: itemId, status: "DELIVERED" });
		expect(Date.parse(body.item.deliveredAt)).toBeGreaterThanOrEqual(before);

		const updateArgs = prismaMock.orderItem.updateMany.mock.calls[0]?.[0];
		expect(updateArgs).toMatchObject({
			where: { id: itemId, status: "READY", tab: { closedAt: null } },
			data: { status: "DELIVERED" },
		});
		expect(updateArgs?.data.deliveredAt).toBeInstanceOf(Date);
	});

	it.each([
		"OWNER",
		"MANAGER",
	] as const)("permite %s marcar como entregue", async (role) => {
		prismaMock.orderItem.findUnique.mockResolvedValue(makeItem("READY"));
		prismaMock.orderItem.updateMany.mockResolvedValue({ count: 1 });

		const response = await deliver(role);

		expect(response.statusCode).toBe(200);
	});

	it.each([
		"RECEIVED",
		"PREPARING",
		"DELIVERED",
		"CANCELLED",
	] as const)("impede entregar item %s (só PRONTO pode ser entregue)", async (status) => {
		prismaMock.orderItem.findUnique.mockResolvedValue(makeItem(status));

		const response = await deliver("WAITER");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body).message).toBe("ORDER_ITEM_NOT_READY");
		expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled();
	});

	it("retorna 409 se o item mudou entre a leitura e a gravação (concorrência)", async () => {
		prismaMock.orderItem.findUnique.mockResolvedValue(makeItem("READY"));
		prismaMock.orderItem.updateMany.mockResolvedValue({ count: 0 });

		const response = await deliver("WAITER");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body).message).toBe("ORDER_ITEM_NOT_READY");
	});

	it("retorna 409 TAB_NOT_OPEN para comanda fechada", async () => {
		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeItem("READY", new Date())
		);

		const response = await deliver("WAITER");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body).message).toBe("TAB_NOT_OPEN");
		expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled();
	});

	it("retorna 404 quando o item não existe na comanda", async () => {
		prismaMock.orderItem.findUnique.mockResolvedValue(null);

		const response = await deliver("WAITER");

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body).message).toBe("ORDER_ITEM_NOT_FOUND");
	});

	it.each([
		"CASHIER",
		"KITCHEN",
		"BILLING",
	] as const)("retorna 403 para %s", async (role) => {
		const response = await deliver(role);

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body).message).toBe("FORBIDDEN");
		expect(prismaMock.orderItem.findUnique).not.toHaveBeenCalled();
	});

	it("retorna 400 para itemId inválido", async () => {
		const response = await deliver("WAITER", { itemId: "not-a-uuid" });

		expect(response.statusCode).toBe(400);
	});

	it("retorna 401 sem token", async () => {
		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/any/tabs/${faker.string.uuid()}/items/${faker.string.uuid()}/deliver`,
		});

		expect(response.statusCode).toBe(401);
	});
});
