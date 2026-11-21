/** The restaurant's local time zone: periods and chart buckets follow it. */
export const REPORT_TIME_ZONE = "America/Sao_Paulo";

export const SALES_PERIODS = ["today", "week", "month"] as const;
export type SalesPeriod = (typeof SALES_PERIODS)[number];
export type SalesGranularity = "hour" | "day";

const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const MS_PER_MINUTE = 60_000;

const WEEKDAY_INDEX: Record<string, number> = {
	Mon: 0,
	Tue: 1,
	Wed: 2,
	Thu: 3,
	Fri: 4,
	Sat: 5,
	Sun: 6,
};

const zonedFormatter = new Intl.DateTimeFormat("en-US", {
	timeZone: REPORT_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
	weekday: "short",
});

interface ZonedParts {
	day: number;
	hour: number;
	minute: number;
	/** 1–12 */
	month: number;
	/** 0 = Monday … 6 = Sunday */
	weekday: number;
	year: number;
}

function getZonedParts(date: Date): ZonedParts {
	const parts = Object.fromEntries(
		zonedFormatter.formatToParts(date).map(({ type, value }) => [type, value])
	);

	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour),
		minute: Number(parts.minute),
		weekday: WEEKDAY_INDEX[parts.weekday ?? "Mon"] ?? 0,
	};
}

/** Instant of a local wall-clock time (handles any fixed or DST offset). */
function zonedTimeToUtc(year: number, month: number, day: number, hour = 0) {
	const guess = Date.UTC(year, month - 1, day, hour);
	const zoned = getZonedParts(new Date(guess));
	const zonedAsUtc = Date.UTC(
		zoned.year,
		zoned.month - 1,
		zoned.day,
		zoned.hour,
		zoned.minute
	);
	const offset =
		Math.round((zonedAsUtc - guess) / MS_PER_MINUTE) * MS_PER_MINUTE;

	return new Date(guess - offset);
}

/** Calendar arithmetic on a local date (normalizes overflowing days/months). */
function addDays(year: number, month: number, day: number, days: number) {
	const date = new Date(Date.UTC(year, month - 1, day + days));

	return {
		year: date.getUTCFullYear(),
		month: date.getUTCMonth() + 1,
		day: date.getUTCDate(),
	};
}

function pad(value: number) {
	return String(value).padStart(2, "0");
}

function dayKey(year: number, month: number, day: number) {
	return `${year}-${pad(month)}-${pad(day)}`;
}

export interface SalesBucket {
	/** Local key matching the SQL grouping: `YYYY-MM-DD` or `YYYY-MM-DDTHH`. */
	key: string;
	startsAt: Date;
}

export interface SalesPeriodRange {
	buckets: SalesBucket[];
	/** Exclusive end of the calendar period (may be in the future). */
	end: Date;
	granularity: SalesGranularity;
	/**
	 * Previous period cut at the same elapsed time as the current one, so
	 * "today until 14h" is compared with "yesterday until 14h".
	 */
	previousEnd: Date;
	previousStart: Date;
	start: Date;
}

/**
 * Calendar periods in the restaurant's time zone: today (from 00h), the
 * current week (from Monday) and the current month (from the 1st).
 */
export function getSalesPeriodRange(
	period: SalesPeriod,
	now: Date = new Date()
): SalesPeriodRange {
	const local = getZonedParts(now);

	let start: Date;
	let end: Date;
	let previousStart: Date;
	let buckets: SalesBucket[];
	let granularity: SalesGranularity;

	if (period === "today") {
		granularity = "hour";
		start = zonedTimeToUtc(local.year, local.month, local.day);
		const tomorrow = addDays(local.year, local.month, local.day, 1);
		end = zonedTimeToUtc(tomorrow.year, tomorrow.month, tomorrow.day);
		const yesterday = addDays(local.year, local.month, local.day, -1);
		previousStart = zonedTimeToUtc(
			yesterday.year,
			yesterday.month,
			yesterday.day
		);

		const today = dayKey(local.year, local.month, local.day);
		buckets = Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
			key: `${today}T${pad(hour)}`,
			startsAt: zonedTimeToUtc(local.year, local.month, local.day, hour),
		}));
	} else {
		granularity = "day";

		const first =
			period === "week"
				? addDays(local.year, local.month, local.day, -local.weekday)
				: { year: local.year, month: local.month, day: 1 };
		const length =
			period === "week"
				? DAYS_PER_WEEK
				: new Date(Date.UTC(local.year, local.month, 0)).getUTCDate();
		const next =
			period === "week"
				? addDays(first.year, first.month, first.day, DAYS_PER_WEEK)
				: addDays(local.year, local.month + 1, 1, 0);
		const previous =
			period === "week"
				? addDays(first.year, first.month, first.day, -DAYS_PER_WEEK)
				: addDays(local.year, local.month - 1, 1, 0);

		start = zonedTimeToUtc(first.year, first.month, first.day);
		end = zonedTimeToUtc(next.year, next.month, next.day);
		previousStart = zonedTimeToUtc(previous.year, previous.month, previous.day);

		buckets = Array.from({ length }, (_, offset) => {
			const date = addDays(first.year, first.month, first.day, offset);

			return {
				key: dayKey(date.year, date.month, date.day),
				startsAt: zonedTimeToUtc(date.year, date.month, date.day),
			};
		});
	}

	const elapsed = now.getTime() - start.getTime();
	const previousEnd = new Date(
		Math.min(previousStart.getTime() + elapsed, start.getTime())
	);

	return { start, end, previousStart, previousEnd, granularity, buckets };
}
