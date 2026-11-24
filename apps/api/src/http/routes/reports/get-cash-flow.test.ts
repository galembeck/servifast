import { randomUUID } from "node:crypto";
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
const NOW = new Date("2026-11-24T15:00:00Z");
describe("GET /restaurants/:slug/reports/cash-flow", () => {
	let app: Awaited<ReturnType<typeof buildApp>>;
	let userId: string;
	let restaurant: ReturnType<typeof mockMembership>["restaurant"];
	let headers: { authorization: string };
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
		userId = randomUUID();
		restaurant = mockMembership(userId).restaurant;
		headers = { authorization: `Bearer ${signToken(app, userId)}` };
		prismaMock.$queryRawUnsafe.mockResolvedValue([]);
	});
	afterEach(() => {
		vi.useRealTimers();
	});
	function get(period = "today") {
		return app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/reports/cash-flow?period=${period}`,
			headers,
		});
	}
	it.each([
		"today",
		"week",
		"month",
	])("returns %s totals from the same daily series", async (period) => {
		prismaMock.$queryRawUnsafe.mockResolvedValue([
			{
				bucket: "2026-11-24",
				incomingInCents: 12000n,
				outgoingInCents: 15000n,
			},
		]);
		const response = await get(period);
		expect(response.statusCode).toBe(200);
		const report = response.json();
		expect(report.totals).toEqual({
			incomingInCents: 12_000,
			outgoingInCents: 15_000,
			netInCents: -3000,
		});
		for (const key of ["incomingInCents", "outgoingInCents", "netInCents"]) {
			expect(
				report.series.reduce(
					(sum: number, point: Record<string, number>) =>
						sum + (point[key] ?? 0),
					0
				)
			).toBe(report.totals[key]);
		}
		expect(prismaMock.$queryRawUnsafe).toHaveBeenCalledWith(
			expect.any(String),
			restaurant.id,
			expect.any(String),
			NOW.toISOString(),
			"America/Sao_Paulo",
			expect.any(String)
		);
	});
	it("returns a zero-filled empty period", async () => {
		const report = (await get()).json();
		expect(report.totals.netInCents).toBe(0);
		expect(report.series).toEqual([
			{
				bucket: "2026-11-24",
				incomingInCents: 0,
				outgoingInCents: 0,
				netInCents: 0,
			},
		]);
	});
	it.each([
		"invalid",
		"day",
		"",
	])("rejects invalid period %s", async (period) => {
		expect((await get(period)).statusCode).toBe(400);
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});
	it("requires a period", async () => {
		const r = await app.inject({
			url: `/restaurants/${restaurant.slug}/reports/cash-flow`,
			headers,
		});
		expect(r.statusCode).toBe(400);
	});
	it("requires authentication", async () => {
		headers = { authorization: "" };
		expect((await get()).statusCode).toBe(401);
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});
	it.each([
		"BILLING",
		"MANAGER",
		"CASHIER",
		"WAITER",
		"KITCHEN",
	] as const)("denies %s", async (role) => {
		restaurant = mockMembership(userId, role).restaurant;
		expect((await get()).statusCode).toBe(403);
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});
	it("denies an OWNER who does not own the restaurant", async () => {
		prismaMock.member.findFirst.mockResolvedValue({
			role: "OWNER",
			restaurant: { ...restaurant, ownerId: randomUUID() },
		});
		expect((await get()).statusCode).toBe(403);
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});
	it("denies access to a different restaurant without membership", async () => {
		prismaMock.member.findFirst.mockResolvedValue(null);
		expect((await get()).statusCode).toBe(401);
		expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
	});
});
