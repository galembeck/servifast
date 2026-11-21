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

describe("GET /restaurants/:slug/reports/sales", () => {
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

	/** Mocks the 5 queries in the order the report runs them. */
	function mockQueries({
		kpis = [{ revenueInCents: 8000n, salesCount: 2, itemsSold: 5 }],
		previousKpis = [{ revenueInCents: "4000", salesCount: 1, itemsSold: 2 }],
		series = [
			{ bucket: "2026-11-21T10", revenueInCents: 8000n, salesCount: 2 },
		],
		methods = [
			{ method: "PIX", revenueInCents: 5000n, salesCount: 1 },
			{ method: "CASH", revenueInCents: 3000n, salesCount: 1 },
		],
		topItems = [
			{
				menuItemId: faker.string.uuid(),
				name: "Água Mineral",
				quantity: 4,
				revenueInCents: 6000n,
			},
		],
	}: Record<string, unknown[]> = {}) {
		prismaMock.$queryRawUnsafe
			.mockResolvedValueOnce(kpis)
			.mockResolvedValueOnce(previousKpis)
			.mockResolvedValueOnce(series)
			.mockResolvedValueOnce(methods)
			.mockResolvedValueOnce(topItems);
	}

	async function getReport(role: Role, query = "?period=today") {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/reports/sales${query}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		return { response, restaurant };
	}

	it("consolidates today's sales for OWNER: KPIs, comparison, hourly series, methods and top items", async () => {
		mockQueries();

		const { response, restaurant } = await getReport("OWNER");

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);

		expect(body).toMatchObject({
			period: "today",
			granularity: "hour",
			range: {
				start: "2026-11-21T03:00:00.000Z",
				end: "2026-11-22T03:00:00.000Z",
			},
			comparisonRange: {
				start: "2026-11-20T03:00:00.000Z",
				end: "2026-11-20T17:30:00.000Z",
			},
			kpis: {
				revenueInCents: 8000,
				salesCount: 2,
				averageTicketInCents: 4000,
				itemsSold: 5,
			},
			previousKpis: {
				revenueInCents: 4000,
				salesCount: 1,
				averageTicketInCents: 4000,
				itemsSold: 2,
			},
			byPaymentMethod: [
				{ method: "CASH", revenueInCents: 3000, salesCount: 1 },
				{ method: "CREDIT_CARD", revenueInCents: 0, salesCount: 0 },
				{ method: "DEBIT_CARD", revenueInCents: 0, salesCount: 0 },
				{ method: "PIX", revenueInCents: 5000, salesCount: 1 },
			],
			topItems: [{ name: "Água Mineral", quantity: 4, revenueInCents: 6000 }],
		});

		// 24 hourly buckets: sales at 10h, empty past hours at 0, future hours null.
		expect(body.series).toHaveLength(24);
		expect(body.series[10]).toMatchObject({
			bucket: "2026-11-21T10",
			revenueInCents: 8000,
			salesCount: 2,
		});
		expect(body.series[9].revenueInCents).toBe(0);
		expect(body.series[14].revenueInCents).toBe(0);
		expect(body.series[15].revenueInCents).toBeNull();
		expect(body.series[23].salesCount).toBeNull();

		// Every query is scoped to the restaurant and the period bounds.
		const calls = prismaMock.$queryRawUnsafe.mock.calls;
		expect(calls).toHaveLength(5);
		expect(calls[0]?.slice(1)).toEqual([
			restaurant.id,
			"2026-11-21T03:00:00.000Z",
			NOW.toISOString(),
		]);
		expect(calls[1]?.slice(1)).toEqual([
			restaurant.id,
			"2026-11-20T03:00:00.000Z",
			"2026-11-20T17:30:00.000Z",
		]);
		expect(calls[2]?.slice(4)).toEqual([
			"hour",
			"America/Sao_Paulo",
			'YYYY-MM-DD"T"HH24',
		]);
		expect(calls[2]?.[0]).toContain("GROUP BY");
		expect(calls[0]?.[0]).toContain("SUM(");
		expect(calls[0]?.[0]).toContain("COUNT(");
	});

	it("returns a daily series from Monday for the week, for BILLING", async () => {
		mockQueries({ series: [] });

		const { response } = await getReport("BILLING", "?period=week");

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body.granularity).toBe("day");
		expect(
			body.series.map((point: { bucket: string }) => point.bucket)
		).toEqual([
			"2026-11-16",
			"2026-11-17",
			"2026-11-18",
			"2026-11-19",
			"2026-11-20",
			"2026-11-21",
			"2026-11-22",
		]);
		expect(body.series[5].revenueInCents).toBe(0);
		expect(body.series[6].revenueInCents).toBeNull();
		expect(prismaMock.$queryRawUnsafe.mock.calls[2]?.slice(4)).toEqual([
			"day",
			"America/Sao_Paulo",
			"YYYY-MM-DD",
		]);
	});

	it("returns one bucket per day of the month", async () => {
		mockQueries({ series: [] });

		const { response } = await getReport("OWNER", "?period=month");

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body.series).toHaveLength(30);
		expect(body.range.start).toBe("2026-11-01T03:00:00.000Z");
	});

	it("returns zeroed KPIs (and no division by zero) for a period without sales", async () => {
		mockQueries({
			kpis: [{ revenueInCents: 0n, salesCount: 0, itemsSold: 0 }],
			previousKpis: [{ revenueInCents: 0n, salesCount: 0, itemsSold: 0 }],
			series: [],
			methods: [],
			topItems: [],
		});

		const { response } = await getReport("OWNER");

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body.kpis).toEqual({
			revenueInCents: 0,
			salesCount: 0,
			averageTicketInCents: 0,
			itemsSold: 0,
		});
		expect(body.topItems).toEqual([]);
		expect(
			body.byPaymentMethod.every(
				(method: { revenueInCents: number }) => method.revenueInCents === 0
			)
		).toBe(true);
	});

	it.each([
		"?period=year",
		"?period=",
		"",
	])("returns 400 for an invalid or missing period (%s)", async (query) => {
		const { response } = await getReport("OWNER", query);

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});

	it.each([
		"MANAGER",
		"WAITER",
		"CASHIER",
		"KITCHEN",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const { response } = await getReport(role);

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});

	it("returns 401 INVALID_TOKEN without an Authorization header", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/restaurants/test-restaurant/reports/sales?period=today",
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
