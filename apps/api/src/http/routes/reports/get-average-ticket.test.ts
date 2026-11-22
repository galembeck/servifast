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

describe("GET /restaurants/:slug/reports/average-ticket", () => {
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

	/** Current period KPIs first, then the previous period's. */
	function mockKpis(
		current: Record<string, unknown>,
		previous: Record<string, unknown>
	) {
		prismaMock.$queryRawUnsafe
			.mockResolvedValueOnce([current])
			.mockResolvedValueOnce([previous]);
	}

	async function getTicket(role: Role, query = "?period=month") {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/reports/average-ticket${query}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		return { response, restaurant };
	}

	it("computes RN01 (consolidated revenue / completed services) for OWNER", async () => {
		mockKpis(
			{ revenueInCents: 15_500n, salesCount: 5, itemsSold: 9 },
			{ revenueInCents: "12000", salesCount: 4, itemsSold: 7 }
		);

		const { response, restaurant } = await getTicket("OWNER");

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			period: "month",
			range: { start: "2026-11-01T03:00:00.000Z" },
			comparisonRange: {
				start: "2026-10-01T03:00:00.000Z",
				end: "2026-10-21T17:30:00.000Z",
			},
			current: {
				revenueInCents: 15_500,
				completedServices: 5,
				averageTicketInCents: 3100,
			},
			previous: {
				revenueInCents: 12_000,
				completedServices: 4,
				averageTicketInCents: 3000,
			},
		});

		const calls = prismaMock.$queryRawUnsafe.mock.calls;
		expect(calls).toHaveLength(2);
		expect(calls[0]?.slice(1)).toEqual([
			restaurant.id,
			"2026-11-01T03:00:00.000Z",
			NOW.toISOString(),
		]);
		// Only completed services: every KPI query joins on payments.
		expect(calls[0]?.[0]).toContain("FROM payments p");
	});

	it("rounds the average ticket to whole cents", async () => {
		mockKpis(
			{ revenueInCents: 10_000n, salesCount: 3, itemsSold: 3 },
			{ revenueInCents: 0n, salesCount: 0, itemsSold: 0 }
		);

		const { response } = await getTicket("BILLING", "?period=today");

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body).current.averageTicketInCents).toBe(3333);
	});

	it("returns 0 instead of dividing by zero when no service was completed", async () => {
		mockKpis(
			{ revenueInCents: 0n, salesCount: 0, itemsSold: 0 },
			{ revenueInCents: 0n, salesCount: 0, itemsSold: 0 }
		);

		const { response } = await getTicket("OWNER", "?period=week");

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body).current).toEqual({
			averageTicketInCents: 0,
			revenueInCents: 0,
			completedServices: 0,
		});
	});

	it.each([
		"?period=year",
		"",
	])("returns 400 for an invalid or missing period (%s)", async (query) => {
		const { response } = await getTicket("OWNER", query);

		expect(response.statusCode).toBe(400);
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});

	it.each([
		"MANAGER",
		"WAITER",
		"CASHIER",
		"KITCHEN",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const { response } = await getTicket(role);

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});

	it("returns 401 INVALID_TOKEN without an Authorization header", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/restaurants/test-restaurant/reports/average-ticket?period=today",
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
