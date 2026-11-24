import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../generated/prisma/client.js";
import { fetchCashFlow } from "./cash-flow";

// Opt-in real PostgreSQL coverage. Only the two uniquely identified fixtures
// below are ever removed; no seed/reset or changes to existing restaurants.
const url = process.env.SERVIFAST_TEST_DATABASE_URL;
const NOW = new Date("2026-11-24T15:00:00Z");
describe.skipIf(!url)("cash flow against PostgreSQL", () => {
	let prisma: PrismaClient;
	const ownerId = randomUUID();
	const restaurantId = randomUUID();
	const otherId = randomUUID();
	const tableId = randomUUID();
	const otherTableId = randomUUID();
	async function entry(
		type: "EXPENSE" | "INCOME",
		status: "PENDING" | "LEGACY" | "PAID" | "RECEIVED",
		amount: number,
		day: string,
		restaurant = restaurantId
	) {
		const settled = status === "PAID" || status === "RECEIVED";
		await prisma.expense.create({
			data: {
				restaurantId: restaurant,
				type,
				status,
				category: "SNEXS-137 test",
				amountInCents: amount,
				occurredAt: NOW,
				settledOn: settled ? new Date(`${day}T00:00:00Z`) : null,
				settledAt: settled ? new Date("2026-12-15T15:00:00Z") : null,
			},
		});
	}
	async function payment(
		date: string,
		amount: number,
		restaurant = restaurantId
	) {
		const tab = await prisma.tab.create({
			data: {
				tableId: restaurant === restaurantId ? tableId : otherTableId,
				restaurantId: restaurant,
				closedAt: new Date(date),
			},
		});
		await prisma.payment.create({
			data: {
				tabId: tab.id,
				restaurantId: restaurant,
				paidById: ownerId,
				method: "CASH",
				amountInCents: amount,
				receivedInCents: amount + 10_000,
				changeInCents: 10_000,
				createdAt: new Date(date),
			},
		});
	}
	beforeAll(async () => {
		prisma = new PrismaClient({
			adapter: new PrismaPg({ connectionString: url ?? "" }),
		});
		await prisma.user.create({
			data: { id: ownerId, email: `${ownerId}@snexs137.test` },
		});
		for (const id of [restaurantId, otherId]) {
			await prisma.restaurant.create({
				data: { id, name: "SNEXS-137 test", slug: `snexs137-${id}`, ownerId },
			});
		}
		await prisma.table.create({
			data: { id: tableId, restaurantId, number: 1, seatsCount: 2 },
		});
		await prisma.table.create({
			data: {
				id: otherTableId,
				restaurantId: otherId,
				number: 1,
				seatsCount: 2,
			},
		});
		for (const [date, amount] of [
			["2026-11-24T02:59:59.999Z", 100],
			["2026-11-24T03:00:00Z", 10_000],
			["2026-11-25T03:00:00Z", 777],
			["2026-11-23T02:59:59.999Z", 200],
			["2026-11-23T03:00:00Z", 500],
			["2026-11-01T02:59:59.999Z", 300],
			["2026-11-01T03:00:00Z", 700],
		] as const) {
			await payment(date, amount);
		}
		await payment("2026-11-24T04:00:00Z", 999_999, otherId);
		await entry("INCOME", "RECEIVED", 2000, "2026-11-24");
		await entry("EXPENSE", "PAID", 15_000, "2026-11-24");
		await entry("INCOME", "RECEIVED", 3000, "2026-11-23");
		await entry("EXPENSE", "PAID", 4000, "2026-11-22");
		await entry("INCOME", "RECEIVED", 9000, "2026-10-31");
		await entry("EXPENSE", "PAID", 6000, "2026-11-01");
		await entry("INCOME", "RECEIVED", 999_000, "2026-11-25");
		await entry("INCOME", "PENDING", 999_000, "2026-11-24");
		await entry("EXPENSE", "PENDING", 999_000, "2026-11-24");
		await entry("EXPENSE", "LEGACY", 999_000, "2026-11-24");
		await entry("INCOME", "RECEIVED", 999_000, "2026-11-24", otherId);
		const session = await prisma.cashRegisterSession.create({
			data: {
				restaurantId,
				openedById: ownerId,
				openingAmountInCents: 500_000,
			},
		});
		for (const type of ["SUPPLY", "WITHDRAWAL"] as const) {
			await prisma.cashRegisterTransaction.create({
				data: {
					restaurantId,
					sessionId: session.id,
					operatorId: ownerId,
					type,
					amountInCents: 30_000,
					createdAt: NOW,
				},
			});
		}
	}, 60_000);
	afterAll(async () => {
		if (!prisma) {
			return;
		}
		try {
			await prisma.restaurant.deleteMany({
				where: { id: { in: [restaurantId, otherId] } },
			});
			await prisma.user.deleteMany({ where: { id: ownerId } });
		} finally {
			await prisma.$disconnect();
		}
	}, 30_000);
	it.each([
		["today", 12_000, 15_000, 1],
		["week", 15_600, 15_000, 7],
		["month", 16_500, 25_000, 30],
	] as const)("%s includes paid sales and settlements, with correct local boundaries", async (period, incoming, outgoing, length) => {
		const report = await fetchCashFlow(prisma, restaurantId, period, NOW);
		expect(report.totals).toEqual({
			incomingInCents: incoming,
			outgoingInCents: outgoing,
			netInCents: incoming - outgoing,
		});
		expect(report.series).toHaveLength(length);
		expect(report.series.reduce((sum, p) => sum + p.incomingInCents, 0)).toBe(
			incoming
		);
		expect(report.series.reduce((sum, p) => sum + p.outgoingInCents, 0)).toBe(
			outgoing
		);
		expect(report.series.find((p) => p.bucket === "2026-11-24")).toMatchObject({
			incomingInCents: 12_000,
			outgoingInCents: 15_000,
		});
	});
	it("assigns manual income by calendar date, regardless of settlement timestamp", async () => {
		const report = await fetchCashFlow(prisma, restaurantId, "week", NOW);
		expect(report.series.find((p) => p.bucket === "2026-11-23")).toMatchObject({
			incomingInCents: 3600,
			outgoingInCents: 0,
		});
	});
	it("has no movements before the fixtures exist", async () => {
		const report = await fetchCashFlow(
			prisma,
			restaurantId,
			"month",
			new Date("2025-01-15T12:00:00Z")
		);
		expect(report.totals).toEqual({
			incomingInCents: 0,
			outgoingInCents: 0,
			netInCents: 0,
		});
		expect(report.series).toHaveLength(31);
	});
});
