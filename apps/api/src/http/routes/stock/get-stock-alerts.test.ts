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

function alertRow(overrides: Record<string, unknown> = {}) {
	return {
		menuItemId: faker.string.uuid(),
		name: faker.commerce.productName(),
		categoryName: "Bebidas",
		stockQuantity: 3,
		minStockQuantity: 10,
		level: "LOW",
		...overrides,
	};
}

// Rows come back from the query already compared and ordered (RN01).
const soldOutBeer = alertRow({
	name: "Cerveja Long Neck",
	stockQuantity: 0n,
	minStockQuantity: 12n,
	level: "CRITICAL",
});
const lowWater = alertRow({
	name: "Água Mineral",
	stockQuantity: 2,
	minStockQuantity: 10,
});
const atMinimumJuice = alertRow({
	name: "Suco de Laranja",
	categoryName: null,
	stockQuantity: 5,
	minStockQuantity: 5,
});

describe("GET /restaurants/:slug/stock/alerts", () => {
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

	async function getAlerts(role: Role, query = "") {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/stock/alerts${query}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		return { response, restaurant };
	}

	it("lists every alert with its level and the units missing, for OWNER", async () => {
		prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
			soldOutBeer,
			lowWater,
			atMinimumJuice,
		]);

		const { response, restaurant } = await getAlerts("OWNER");

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			filter: "all",
			summary: { total: 3, critical: 1, low: 2 },
			alerts: [
				{
					menuItemId: soldOutBeer.menuItemId,
					name: "Cerveja Long Neck",
					stockQuantity: 0,
					minStockQuantity: 12,
					level: "CRITICAL",
					missingToMinimum: 12,
				},
				{ name: "Água Mineral", level: "LOW", missingToMinimum: 8 },
				{
					name: "Suco de Laranja",
					categoryName: null,
					level: "LOW",
					missingToMinimum: 0,
				},
			],
		});

		const [sql, ...params] = prismaMock.$queryRawUnsafe.mock.calls[0] ?? [];
		expect(params).toEqual([restaurant.id]);
		// RN01: balance compared with the minimum in the query itself.
		expect(sql).toContain("mi.stock_quantity <= mi.min_stock_quantity");
		expect(sql).toContain("mi.min_stock_quantity IS NOT NULL");
		expect(sql).toContain(
			"CASE WHEN mi.stock_quantity <= 0 THEN 'CRITICAL' ELSE 'LOW' END"
		);
	});

	it.each([
		["critical", ["Cerveja Long Neck"]],
		["low", ["Água Mineral", "Suco de Laranja"]],
	])("filters by level=%s but keeps the full summary", async (level, names) => {
		prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
			soldOutBeer,
			lowWater,
			atMinimumJuice,
		]);

		const { response } = await getAlerts("OWNER", `?level=${level}`);

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body.filter).toBe(level);
		expect(body.summary).toEqual({ total: 3, critical: 1, low: 2 });
		expect(body.alerts.map((alert: { name: string }) => alert.name)).toEqual(
			names
		);
	});

	it("allows MANAGER", async () => {
		prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

		const { response } = await getAlerts("MANAGER");

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			summary: { total: 0, critical: 0, low: 0 },
			alerts: [],
		});
	});

	it("returns 400 for an unknown level", async () => {
		const { response } = await getAlerts("OWNER", "?level=urgent");

		expect(response.statusCode).toBe(400);
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});

	it.each([
		"WAITER",
		"CASHIER",
		"KITCHEN",
		"BILLING",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const { response } = await getAlerts(role);

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});

	it("returns 401 INVALID_TOKEN without an Authorization header", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/restaurants/test-restaurant/stock/alerts",
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
