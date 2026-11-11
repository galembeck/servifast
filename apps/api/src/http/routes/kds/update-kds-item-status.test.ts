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

type ItemStatus = "RECEIVED" | "PREPARING" | "READY" | "CANCELLED";

function makeKitchenItem({
	status = "RECEIVED",
	sentToKitchenAt = new Date(),
	tabClosedAt = null,
}: {
	status?: ItemStatus;
	sentToKitchenAt?: Date | null;
	tabClosedAt?: Date | null;
} = {}) {
	return { status, sentToKitchenAt, tab: { closedAt: tabClosedAt } };
}

describe("PATCH /restaurants/:slug/kds/items/:itemId/status", () => {
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

	function patchStatus(
		role: "OWNER" | "MANAGER" | "WAITER" | "CASHIER" | "KITCHEN" | "BILLING",
		status: string,
		itemId = faker.string.uuid()
	) {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		return app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/kds/items/${itemId}/status`,
			headers: { Authorization: `Bearer ${token}` },
			payload: { status },
		});
	}

	it("inicia o preparo: RECEIVED → PREPARING como KITCHEN (cenário principal)", async () => {
		const itemId = faker.string.uuid();
		const updatedAt = new Date();

		prismaMock.orderItem.findUnique
			.mockResolvedValueOnce(makeKitchenItem({ status: "RECEIVED" }))
			.mockResolvedValueOnce({ id: itemId, updatedAt });
		prismaMock.orderItem.updateMany.mockResolvedValue({ count: 1 });

		const response = await patchStatus("KITCHEN", "PREPARING", itemId);

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			item: { id: itemId, status: "PREPARING" },
		});
		expect(prismaMock.orderItem.updateMany).toHaveBeenCalledWith({
			where: { id: itemId, status: "RECEIVED", tab: { closedAt: null } },
			data: { status: "PREPARING" },
		});
	});

	it("conclui o preparo: PREPARING → READY como KITCHEN", async () => {
		const itemId = faker.string.uuid();

		prismaMock.orderItem.findUnique
			.mockResolvedValueOnce(makeKitchenItem({ status: "PREPARING" }))
			.mockResolvedValueOnce({ id: itemId, updatedAt: new Date() });
		prismaMock.orderItem.updateMany.mockResolvedValue({ count: 1 });

		const response = await patchStatus("KITCHEN", "READY", itemId);

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			item: { id: itemId, status: "READY" },
		});
		expect(prismaMock.orderItem.updateMany).toHaveBeenCalledWith({
			where: { id: itemId, status: "PREPARING", tab: { closedAt: null } },
			data: { status: "READY" },
		});
	});

	it.each([
		"OWNER",
		"MANAGER",
	] as const)("permite %s atualizar o status", async (role) => {
		prismaMock.orderItem.findUnique
			.mockResolvedValueOnce(makeKitchenItem({ status: "RECEIVED" }))
			.mockResolvedValueOnce({
				id: faker.string.uuid(),
				updatedAt: new Date(),
			});
		prismaMock.orderItem.updateMany.mockResolvedValue({ count: 1 });

		const response = await patchStatus(role, "PREPARING");

		expect(response.statusCode).toBe(200);
	});

	it("impede pular etapa: RECEIVED → READY retorna 409", async () => {
		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeKitchenItem({ status: "RECEIVED" })
		);

		const response = await patchStatus("KITCHEN", "READY");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body).message).toBe("INVALID_STATUS_TRANSITION");
		expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled();
	});

	it("impede voltar etapa / repetir: PREPARING → PREPARING retorna 409", async () => {
		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeKitchenItem({ status: "PREPARING" })
		);

		const response = await patchStatus("KITCHEN", "PREPARING");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body).message).toBe("INVALID_STATUS_TRANSITION");
		expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled();
	});

	it("impede alterar item já PRONTO", async () => {
		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeKitchenItem({ status: "READY" })
		);

		const response = await patchStatus("KITCHEN", "PREPARING");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body).message).toBe("INVALID_STATUS_TRANSITION");
	});

	it("impede alterar item CANCELADO", async () => {
		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeKitchenItem({ status: "CANCELLED" })
		);

		const response = await patchStatus("KITCHEN", "PREPARING");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body).message).toBe("INVALID_STATUS_TRANSITION");
	});

	it("retorna 409 se o status mudou entre a leitura e a gravação (concorrência)", async () => {
		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeKitchenItem({ status: "RECEIVED" })
		);
		prismaMock.orderItem.updateMany.mockResolvedValue({ count: 0 });

		const response = await patchStatus("KITCHEN", "PREPARING");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body).message).toBe("INVALID_STATUS_TRANSITION");
	});

	it("retorna 409 TAB_NOT_OPEN para item de comanda fechada", async () => {
		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeKitchenItem({ tabClosedAt: new Date() })
		);

		const response = await patchStatus("KITCHEN", "PREPARING");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body).message).toBe("TAB_NOT_OPEN");
		expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled();
	});

	it("retorna 404 quando o item não existe no restaurante", async () => {
		prismaMock.orderItem.findUnique.mockResolvedValue(null);

		const response = await patchStatus("KITCHEN", "PREPARING");

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body).message).toBe("KITCHEN_ITEM_NOT_FOUND");
	});

	it("retorna 404 quando o item ainda não foi enviado para a cozinha", async () => {
		prismaMock.orderItem.findUnique.mockResolvedValue(
			makeKitchenItem({ sentToKitchenAt: null })
		);

		const response = await patchStatus("KITCHEN", "PREPARING");

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body).message).toBe("KITCHEN_ITEM_NOT_FOUND");
	});

	it.each([
		"WAITER",
		"CASHIER",
		"BILLING",
	] as const)("retorna 403 para %s", async (role) => {
		const response = await patchStatus(role, "PREPARING");

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body).message).toBe("FORBIDDEN");
		expect(prismaMock.orderItem.findUnique).not.toHaveBeenCalled();
	});

	it.each([
		"RECEIVED",
		"CANCELLED",
		"INVALID",
	])("retorna 400 para status de destino não permitido (%s)", async (status) => {
		const response = await patchStatus("KITCHEN", status);

		expect(response.statusCode).toBe(400);
	});

	it("retorna 400 para itemId inválido", async () => {
		const response = await patchStatus("KITCHEN", "PREPARING", "not-a-uuid");

		expect(response.statusCode).toBe(400);
	});

	it("retorna 401 sem token", async () => {
		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/any/kds/items/${faker.string.uuid()}/status`,
			payload: { status: "PREPARING" },
		});

		expect(response.statusCode).toBe(401);
	});
});
