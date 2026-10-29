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

const MINUTE_IN_MS = 60_000;

interface FakeOrderItem {
	createdAt: Date;
	id: string;
	menuItem: { name: string };
	menuItemId: string;
	notes: string | null;
	quantity: number;
	restaurantId: string;
	sentToKitchenAt: Date | null;
	status: "RECEIVED" | "CANCELLED";
	tab: { table: { number: number; positionReference: string | null } };
	tabId: string;
	updatedAt: Date;
}

function minutesAgo(minutes: number) {
	return new Date(Date.now() - minutes * MINUTE_IN_MS);
}

function makeItem(
	restaurantId: string,
	overrides: Partial<FakeOrderItem> = {}
): FakeOrderItem {
	return {
		id: faker.string.uuid(),
		menuItemId: faker.string.uuid(),
		menuItem: { name: faker.food.dish() },
		quantity: 1,
		notes: null,
		restaurantId,
		status: "RECEIVED",
		sentToKitchenAt: minutesAgo(10),
		createdAt: minutesAgo(15),
		updatedAt: minutesAgo(10),
		tabId: faker.string.uuid(),
		tab: { table: { number: 1, positionReference: "Salão" } },
		...overrides,
	};
}

interface FindManyArgs {
	orderBy: Record<string, "asc" | "desc">[];
	where: {
		restaurantId: string;
		sentToKitchenAt: { not: null };
		status: { in: string[] };
		updatedAt?: { gt: Date };
	};
}

/**
 * Minimal in-memory stand-in for `prisma.orderItem.findMany` that applies the
 * same filters/ordering the KDS route asks for, so tests assert on behaviour
 * (which items come back, in which order), not only on the query shape.
 */
function useInMemoryOrderItems(rows: FakeOrderItem[]) {
	prismaMock.orderItem.findMany.mockImplementation(
		({ where, orderBy }: FindManyArgs) => {
			const filtered = rows.filter(
				(row) =>
					row.restaurantId === where.restaurantId &&
					where.status.in.includes(row.status) &&
					row.sentToKitchenAt !== null &&
					(!where.updatedAt || row.updatedAt > where.updatedAt.gt)
			);

			return Promise.resolve(
				filtered.sort((a, b) => {
					for (const clause of orderBy) {
						const [field] = Object.keys(clause) as (keyof FakeOrderItem)[];
						if (!field) {
							continue;
						}
						const left = (a[field] as Date).getTime();
						const right = (b[field] as Date).getTime();
						if (left !== right) {
							return left - right;
						}
					}
					return 0;
				})
			);
		}
	);
}

const READ_ONLY_METHOD = /^(find|count|aggregate|groupBy)/;

function expectNoWrites() {
	for (const [model, delegate] of Object.entries(prismaMock)) {
		if (typeof delegate === "function") {
			if (model === "$transaction") {
				expect(delegate, model).not.toHaveBeenCalled();
			}
			continue;
		}
		for (const [method, fn] of Object.entries(
			delegate as Record<string, unknown>
		)) {
			if (!READ_ONLY_METHOD.test(method) && vi.isMockFunction(fn)) {
				expect(fn, `${model}.${method}`).not.toHaveBeenCalled();
			}
		}
	}
}

describe("GET /restaurants/:slug/kds/items", () => {
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

	it("retorna só itens enviados e não finalizados, do mais antigo para o mais novo", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const token = signToken(app, userId);

		const oldest = makeItem(restaurant.id, {
			sentToKitchenAt: minutesAgo(30),
			quantity: 2,
			notes: "Sem cebola",
			tab: { table: { number: 7, positionReference: "Varanda" } },
		});
		const newest = makeItem(restaurant.id, { sentToKitchenAt: minutesAgo(2) });
		const middle = makeItem(restaurant.id, { sentToKitchenAt: minutesAgo(10) });
		const cancelled = makeItem(restaurant.id, { status: "CANCELLED" });
		const notSent = makeItem(restaurant.id, { sentToKitchenAt: null });
		const otherRestaurant = makeItem(faker.string.uuid());

		useInMemoryOrderItems([
			newest,
			cancelled,
			oldest,
			notSent,
			middle,
			otherRestaurant,
		]);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/kds/items`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);

		expect(body.items.map((item: { id: string }) => item.id)).toEqual([
			oldest.id,
			middle.id,
			newest.id,
		]);
		expect(body.items[0]).toEqual({
			id: oldest.id,
			productId: oldest.menuItemId,
			productName: oldest.menuItem.name,
			quantity: 2,
			notes: "Sem cebola",
			table: { number: 7, positionReference: "Varanda" },
			tabId: oldest.tabId,
			sentToKitchenAt: oldest.sentToKitchenAt?.toISOString(),
			status: "RECEIVED",
		});
		expect(Number.isNaN(Date.parse(body.serverTime))).toBe(false);
	});

	it("consulta o banco só com os filtros, a ordem e os campos da fila", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const token = signToken(app, userId);
		prismaMock.orderItem.findMany.mockResolvedValue([]);

		await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/kds/items`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(prismaMock.orderItem.findMany).toHaveBeenCalledWith({
			where: {
				restaurantId: restaurant.id,
				status: { in: ["RECEIVED"] },
				sentToKitchenAt: { not: null },
			},
			orderBy: [{ sentToKitchenAt: "asc" }, { createdAt: "asc" }],
			select: {
				id: true,
				menuItemId: true,
				quantity: true,
				notes: true,
				tabId: true,
				sentToKitchenAt: true,
				status: true,
				menuItem: { select: { name: true } },
				tab: {
					select: {
						table: { select: { number: true, positionReference: true } },
					},
				},
			},
		});
	});

	it("com since, retorna só itens alterados depois dele", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const token = signToken(app, userId);

		const since = minutesAgo(5);
		const changedBefore = makeItem(restaurant.id, {
			updatedAt: minutesAgo(8),
		});
		const changedExactlyAtSince = makeItem(restaurant.id, { updatedAt: since });
		const changedAfter = makeItem(restaurant.id, { updatedAt: minutesAgo(1) });

		useInMemoryOrderItems([changedBefore, changedExactlyAtSince, changedAfter]);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/kds/items`,
			query: { since: since.toISOString() },
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		expect(
			JSON.parse(response.body).items.map((item: { id: string }) => item.id)
		).toEqual([changedAfter.id]);
		expect(prismaMock.orderItem.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ updatedAt: { gt: since } }),
			})
		);
	});

	it("serverTime é capturado antes da consulta (pode ser usado como próximo since)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const token = signToken(app, userId);

		let queriedAt = 0;
		prismaMock.orderItem.findMany.mockImplementation(() => {
			queriedAt = Date.now();
			return Promise.resolve([]);
		});

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/kds/items`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(
			Date.parse(JSON.parse(response.body).serverTime)
		).toBeLessThanOrEqual(queriedAt);
	});

	it.each([
		"ontem",
		"2026-13-45T99:99:99Z",
		"1730000000",
		"2026-10-29",
	])("since inválido (%s) retorna 422 INVALID_SINCE", async (since) => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/kds/items`,
			query: { since },
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(422);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_SINCE",
		});
		expect(prismaMock.orderItem.findMany).not.toHaveBeenCalled();
	});

	it("é somente leitura: não altera kds_events.processedAt nem nenhum item", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const token = signToken(app, userId);
		useInMemoryOrderItems([makeItem(restaurant.id), makeItem(restaurant.id)]);

		const queries: Record<string, string>[] = [
			{},
			{ since: minutesAgo(60).toISOString() },
		];

		for (const query of queries) {
			const response = await app.inject({
				method: "GET",
				url: `/restaurants/${restaurant.slug}/kds/items`,
				query,
				headers: { Authorization: `Bearer ${token}` },
			});
			expect(response.statusCode).toBe(200);
		}

		expect(prismaMock.kdsEvent.update).not.toHaveBeenCalled();
		expect(prismaMock.orderItem.update).not.toHaveBeenCalled();
		expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled();
		expectNoWrites();
	});

	it.each([
		"OWNER",
		"MANAGER",
		"WAITER",
		"CASHIER",
		"KITCHEN",
	] as const)("%s pode ver a fila da cozinha", async (role) => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);
		prismaMock.orderItem.findMany.mockResolvedValue([]);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/kds/items`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
	});

	it("retorna 403 FORBIDDEN para BILLING", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "BILLING");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/kds/items`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.orderItem.findMany).not.toHaveBeenCalled();
	});

	it("retorna 401 INVALID_TOKEN sem autenticação", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/restaurants/any-restaurant/kds/items",
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
		expect(prismaMock.orderItem.findMany).not.toHaveBeenCalled();
	});

	it("retorna 404 RESTAURANT_NOT_FOUND quando o restaurante não existe", async () => {
		const userId = faker.string.uuid();
		const token = signToken(app, userId);
		prismaMock.member.findFirst.mockResolvedValue(null);
		prismaMock.restaurant.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "GET",
			url: "/restaurants/nao-existe/kds/items",
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "RESTAURANT_NOT_FOUND",
		});
		expect(prismaMock.orderItem.findMany).not.toHaveBeenCalled();
	});

	it("retorna 401 UNAUTHORIZED quando o restaurante existe mas o usuário não é membro", async () => {
		const userId = faker.string.uuid();
		const token = signToken(app, userId);
		prismaMock.member.findFirst.mockResolvedValue(null);
		prismaMock.restaurant.findUnique.mockResolvedValue({
			id: faker.string.uuid(),
		});

		const response = await app.inject({
			method: "GET",
			url: "/restaurants/outro-restaurante/kds/items",
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
		expect(prismaMock.orderItem.findMany).not.toHaveBeenCalled();
	});
});
