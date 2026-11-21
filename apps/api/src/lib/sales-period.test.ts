import { describe, expect, it } from "vitest";
import { getSalesPeriodRange } from "./sales-period";

// Saturday, 21/11/2026 14:30 in São Paulo (UTC−3).
const NOW = new Date("2026-11-21T17:30:00.000Z");

describe("getSalesPeriodRange", () => {
	it("today: local midnight to midnight, hourly buckets, compared with yesterday until the same hour", () => {
		const range = getSalesPeriodRange("today", NOW);

		expect(range.granularity).toBe("hour");
		expect(range.start.toISOString()).toBe("2026-11-21T03:00:00.000Z");
		expect(range.end.toISOString()).toBe("2026-11-22T03:00:00.000Z");
		expect(range.previousStart.toISOString()).toBe("2026-11-20T03:00:00.000Z");
		expect(range.previousEnd.toISOString()).toBe("2026-11-20T17:30:00.000Z");
		expect(range.buckets).toHaveLength(24);
		expect(range.buckets[0]).toEqual({
			key: "2026-11-21T00",
			startsAt: new Date("2026-11-21T03:00:00.000Z"),
		});
		expect(range.buckets[23]?.key).toBe("2026-11-21T23");
	});

	it("week: starts on Monday, daily buckets, compared with last week at the same point", () => {
		const range = getSalesPeriodRange("week", NOW);

		expect(range.granularity).toBe("day");
		expect(range.start.toISOString()).toBe("2026-11-16T03:00:00.000Z");
		expect(range.end.toISOString()).toBe("2026-11-23T03:00:00.000Z");
		expect(range.previousStart.toISOString()).toBe("2026-11-09T03:00:00.000Z");
		expect(range.previousEnd.toISOString()).toBe("2026-11-14T17:30:00.000Z");
		expect(range.buckets.map((bucket) => bucket.key)).toEqual([
			"2026-11-16",
			"2026-11-17",
			"2026-11-18",
			"2026-11-19",
			"2026-11-20",
			"2026-11-21",
			"2026-11-22",
		]);
	});

	it("month: starts on the 1st with one bucket per day of the month", () => {
		const range = getSalesPeriodRange("month", NOW);

		expect(range.start.toISOString()).toBe("2026-11-01T03:00:00.000Z");
		expect(range.end.toISOString()).toBe("2026-12-01T03:00:00.000Z");
		expect(range.previousStart.toISOString()).toBe("2026-10-01T03:00:00.000Z");
		expect(range.previousEnd.toISOString()).toBe("2026-10-21T17:30:00.000Z");
		expect(range.buckets).toHaveLength(30);
		expect(range.buckets.at(-1)?.key).toBe("2026-11-30");
	});

	it("uses the local date, not the UTC one, late at night", () => {
		// 23:30 on 21/11 in São Paulo is already 22/11 in UTC.
		const range = getSalesPeriodRange(
			"today",
			new Date("2026-11-22T02:30:00.000Z")
		);

		expect(range.buckets[0]?.key).toBe("2026-11-21T00");
		expect(range.start.toISOString()).toBe("2026-11-21T03:00:00.000Z");
	});

	it("clamps the comparison to the previous month when it is shorter", () => {
		// 31/03 12:00: 30 days elapsed, but February 2026 only has 28.
		const range = getSalesPeriodRange(
			"month",
			new Date("2026-03-31T15:00:00.000Z")
		);

		expect(range.previousStart.toISOString()).toBe("2026-02-01T03:00:00.000Z");
		expect(range.previousEnd.toISOString()).toBe("2026-03-01T03:00:00.000Z");
		expect(range.buckets).toHaveLength(31);
	});

	it("crosses the year boundary for weeks and months", () => {
		// Thursday, 01/01/2026 09:00 in São Paulo.
		const now = new Date("2026-01-01T12:00:00.000Z");

		const week = getSalesPeriodRange("week", now);
		expect(week.start.toISOString()).toBe("2025-12-29T03:00:00.000Z");
		expect(week.buckets[3]?.key).toBe("2026-01-01");

		const month = getSalesPeriodRange("month", now);
		expect(month.previousStart.toISOString()).toBe("2025-12-01T03:00:00.000Z");
		expect(month.end.toISOString()).toBe("2026-02-01T03:00:00.000Z");
	});
});
