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

function makeFreeTable(restaurantId: string, tableId = faker.string.uuid()) {
	return {
		id: tableId,
		number: 1,
		positionReference: null,
		seatsCount: 4,
		observations: null,
		status: "FREE" as const,
		occupiedSeats: 0,
		restaurantId,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

function makeTab(tableId: string, restaurantId: string) {
	return {
		id: faker.string.uuid(),
		customerName: null,
		peopleCount: null,
		openedAt: new Date(),
		createdAt: new Date(),
		tableId,
		restaurantId,
	};
}

describe("POST /restaurants/:slug/tables/:tableId/open-tab", () => {
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

	it("opens a tab for a FREE table as WAITER (cenário principal)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tableId = faker.string.uuid();
		const table = makeFreeTable(restaurant.id, tableId);
		const tab = makeTab(tableId, restaurant.id);

		prismaMock.table.findUnique.mockResolvedValue(table);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					tab: { create: vi.fn().mockResolvedValue(tab) },
					table: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
				};
				return fn(tx);
			}
			return fn;
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables/${tableId}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: { customerName: "João", peopleCount: 2 },
		});

		expect(response.statusCode).toBe(201);
		const body = JSON.parse(response.body);
		expect(body).toMatchObject({
			tab: { id: tab.id },
			table: { id: tableId, status: "OCCUPIED" },
		});
	});

	it("opens a tab for a FREE table as MANAGER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "MANAGER");
		const tableId = faker.string.uuid();
		const tab = makeTab(tableId, restaurant.id);

		prismaMock.table.findUnique.mockResolvedValue(
			makeFreeTable(restaurant.id, tableId)
		);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					tab: { create: vi.fn().mockResolvedValue(tab) },
					table: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
				};
				return fn(tx);
			}
			return fn;
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables/${tableId}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: {},
		});

		expect(response.statusCode).toBe(201);
	});

	it("opens a tab without optional fields", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tableId = faker.string.uuid();
		const tab = makeTab(tableId, restaurant.id);

		prismaMock.table.findUnique.mockResolvedValue(
			makeFreeTable(restaurant.id, tableId)
		);
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					tab: { create: vi.fn().mockResolvedValue(tab) },
					table: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
				};
				return fn(tx);
			}
			return fn;
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables/${tableId}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: {},
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body).tab).toMatchObject({
			customerName: null,
			peopleCount: null,
		});
	});

	it("returns 401 UNAUTHORIZED for CASHIER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "CASHIER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables/${faker.string.uuid()}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: {},
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
			url: `/restaurants/${restaurant.slug}/tables/${faker.string.uuid()}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: {},
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
			url: `/restaurants/${restaurant.slug}/tables/${faker.string.uuid()}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: {},
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "POST",
			url: `/restaurants/some-slug/tables/${faker.string.uuid()}/open-tab`,
			body: {},
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});

	it("returns 404 TABLE_NOT_FOUND when table does not exist", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		prismaMock.table.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables/${faker.string.uuid()}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: {},
		});

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TABLE_NOT_FOUND",
		});
	});

	it("returns 409 TABLE_NOT_FREE when table is OCCUPIED", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tableId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.table.findUnique.mockResolvedValue({
			...makeFreeTable(restaurant.id, tableId),
			status: "OCCUPIED" as const,
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables/${tableId}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: {},
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TABLE_NOT_FREE",
		});
	});

	it("returns 409 TABLE_NOT_FREE when table is BILL_REQUESTED", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tableId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.table.findUnique.mockResolvedValue({
			...makeFreeTable(restaurant.id, tableId),
			status: "BILL_REQUESTED" as const,
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables/${tableId}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: {},
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TABLE_NOT_FREE",
		});
	});

	it("returns 400 validation error when peopleCount is zero", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables/${faker.string.uuid()}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: { peopleCount: 0 },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});

	it("returns 400 validation error when peopleCount is negative", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables/${faker.string.uuid()}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: { peopleCount: -1 },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});

	it("rollback: se tab.create falhar, table.updateMany não é chamado e mesa permanece FREE", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tableId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.table.findUnique.mockResolvedValue(
			makeFreeTable(restaurant.id, tableId)
		);

		const updateManySpy = vi.fn();
		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					tab: {
						create: vi
							.fn()
							.mockRejectedValue(new Error("DB constraint violation")),
					},
					table: { updateMany: updateManySpy },
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables/${tableId}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: {},
		});

		expect(response.statusCode).toBe(500);
		expect(updateManySpy).not.toHaveBeenCalled();
	});

	it("atomicidade: se updateMany retornar count=0, lança 409 e não persiste tab (concorrência)", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const tableId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.table.findUnique.mockResolvedValue(
			makeFreeTable(restaurant.id, tableId)
		);

		prismaMock.$transaction.mockImplementation((fn: unknown) => {
			if (typeof fn === "function") {
				const tx = {
					tab: {
						create: vi.fn().mockResolvedValue(makeTab(tableId, restaurant.id)),
					},
					table: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
				};
				return fn(tx);
			}
			return fn;
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables/${tableId}/open-tab`,
			headers: { Authorization: `Bearer ${token}` },
			body: {},
		});

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TABLE_NOT_FREE",
		});
	});
});
