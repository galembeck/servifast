import { faker } from "@faker-js/faker";
import {
	afterAll,
	afterEach,
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

// Saturday, 21/11/2026 14:30 in São Paulo (UTC−3).
const NOW = new Date("2026-11-21T17:30:00.000Z");

function productRow(overrides: Record<string, unknown> = {}) {
	return {
		menuItemId: faker.string.uuid(),
		name: faker.commerce.productName(),
		categoryName: "Bebidas",
		quantity: 6,
		revenueInCents: 9500n,
		servicesCount: 4,
		averageTicketWithItemInCents: "2875",
		totalUnits: 9,
		...overrides,
	};
}

describe("GET /restaurants/:slug/reports/top-products", () => {
	let app: Awaited<ReturnType<typeof buildApp>>;

	beforeAll(async () => {
		app = await buildApp();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		resetPrismaMocks();
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	async function getTopProducts(role: Role, query = "?period=month") {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/reports/top-products${query}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		return { response, restaurant };
	}

	it("returns the ranking with rank, units share and ticket with the product, for OWNER", async () => {
		const water = productRow({ name: "Água Mineral" });
		const codfish = productRow({
			name: "Bolinho de Bacalhau",
			categoryName: null,
			quantity: 3,
			revenueInCents: 6000n,
			servicesCount: 2,
			averageTicketWithItemInCents: 4500n,
		});
		prismaMock.$queryRawUnsafe.mockResolvedValueOnce([water, codfish]);

		const { response, restaurant } = await getTopProducts("OWNER");

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body).toMatchObject({
			period: "month",
			totalUnits: 9,
			products: [
				{
					rank: 1,
					menuItemId: water.menuItemId,
					name: "Água Mineral",
					categoryName: "Bebidas",
					quantity: 6,
					revenueInCents: 9500,
					servicesCount: 4,
					averageTicketWithItemInCents: 2875,
				},
				{
					rank: 2,
					name: "Bolinho de Bacalhau",
					categoryName: null,
					quantity: 3,
					revenueInCents: 6000,
					averageTicketWithItemInCents: 4500,
				},
			],
		});
		expect(body.products[0].unitsShare).toBeCloseTo(6 / 9);
		expect(body.products[1].unitsShare).toBeCloseTo(3 / 9);

		const [sql, ...params] = prismaMock.$queryRawUnsafe.mock.calls[0] ?? [];
		expect(params).toEqual([
			restaurant.id,
			"2026-11-01T03:00:00.000Z",
			NOW.toISOString(),
		]);
		// Completed services only, cancelled items out, Top 10 by units.
		expect(sql).toContain("JOIN paid_tabs p");
		expect(sql).toContain("SUM(p.amount_in_cents)");
		expect(sql).toContain("<> 'CANCELLED'");
		expect(sql).toContain(
			"ORDER BY pi.quantity DESC, pi.revenue DESC, mi.name ASC"
		);
		expect(sql).toContain("LIMIT 10");
	});

	it("allows BILLING", async () => {
		prismaMock.$queryRawUnsafe.mockResolvedValueOnce([productRow()]);

		const { response } = await getTopProducts("BILLING", "?period=week");

		expect(response.statusCode).toBe(200);
	});

	it("returns an empty ranking for a period without completed services", async () => {
		prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

		const { response } = await getTopProducts("OWNER", "?period=today");

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			totalUnits: 0,
			products: [],
		});
	});

	it.each([
		"?period=all",
		"",
	])("returns 400 for an invalid or missing period (%s)", async (query) => {
		const { response } = await getTopProducts("OWNER", query);

		expect(response.statusCode).toBe(400);
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});

	it.each([
		"MANAGER",
		"WAITER",
		"CASHIER",
		"KITCHEN",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const { response } = await getTopProducts(role);

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});

	it("returns 401 INVALID_TOKEN without an Authorization header", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/restaurants/test-restaurant/reports/top-products?period=today",
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
