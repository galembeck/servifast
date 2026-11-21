import {
	getSalesPeriodRange,
	REPORT_TIME_ZONE,
	type SalesGranularity,
	type SalesPeriod,
} from "./sales-period";

const TOP_ITEMS_LIMIT = 5;
export const PAYMENT_METHODS = [
	"CASH",
	"CREDIT_CARD",
	"DEBIT_CARD",
	"PIX",
] as const;

/** to_char formats producing the same keys as `SalesBucket.key`. */
const BUCKET_FORMAT: Record<SalesGranularity, string> = {
	hour: 'YYYY-MM-DD"T"HH24',
	day: "YYYY-MM-DD",
};

/*
 * `created_at` columns are `timestamp` holding UTC wall time. Range bounds are
 * passed as ISO instants and converted to UTC wall time on the parameter side
 * (not on the column), so the (restaurant_id, created_at) index stays usable.
 * All values go as bind parameters ($n) — nothing is interpolated into SQL.
 */
const IN_RANGE = (alias: string) =>
	`${alias}.restaurant_id = $1
	AND ${alias}.created_at >= ($2::timestamptz AT TIME ZONE 'UTC')
	AND ${alias}.created_at < ($3::timestamptz AT TIME ZONE 'UTC')`;

const KPIS_SQL = `
SELECT
	COALESCE(SUM(p.amount_in_cents), 0)::bigint AS "revenueInCents",
	COUNT(*)::int AS "salesCount",
	COALESCE((
		SELECT SUM(oi.quantity)
		FROM order_items oi
		JOIN payments ip ON ip.tab_id = oi.tab_id
		WHERE ${IN_RANGE("ip")} AND oi.status <> 'CANCELLED'
	), 0)::int AS "itemsSold"
FROM payments p
WHERE ${IN_RANGE("p")}`;

const SERIES_SQL = `
SELECT
	to_char(
		date_trunc($4, (p.created_at AT TIME ZONE 'UTC') AT TIME ZONE $5),
		$6
	) AS "bucket",
	SUM(p.amount_in_cents)::bigint AS "revenueInCents",
	COUNT(*)::int AS "salesCount"
FROM payments p
WHERE ${IN_RANGE("p")}
GROUP BY 1`;

const BY_METHOD_SQL = `
SELECT
	p.method::text AS "method",
	SUM(p.amount_in_cents)::bigint AS "revenueInCents",
	COUNT(*)::int AS "salesCount"
FROM payments p
WHERE ${IN_RANGE("p")}
GROUP BY p.method`;

const TOP_ITEMS_SQL = `
SELECT
	mi.id AS "menuItemId",
	mi.name AS "name",
	SUM(oi.quantity)::int AS "quantity",
	SUM(oi.quantity * oi.unit_price_in_cents)::bigint AS "revenueInCents"
FROM order_items oi
JOIN payments p ON p.tab_id = oi.tab_id
JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE ${IN_RANGE("p")} AND oi.status <> 'CANCELLED'
GROUP BY mi.id, mi.name
ORDER BY "quantity" DESC, "revenueInCents" DESC
LIMIT ${TOP_ITEMS_LIMIT}`;

/** SUM(...)::bigint comes back as BigInt (or a string); cents fit in a number. */
type Numeric = bigint | number | string;

interface KpiRow {
	itemsSold: number;
	revenueInCents: Numeric;
	salesCount: number;
}

interface SeriesRow {
	bucket: string;
	revenueInCents: Numeric;
	salesCount: number;
}

interface MethodRow {
	method: string;
	revenueInCents: Numeric;
	salesCount: number;
}

interface TopItemRow {
	menuItemId: string;
	name: string;
	quantity: number;
	revenueInCents: Numeric;
}

function toKpis(row: KpiRow | undefined) {
	const revenueInCents = Number(row?.revenueInCents ?? 0);
	const salesCount = Number(row?.salesCount ?? 0);

	return {
		revenueInCents,
		salesCount,
		averageTicketInCents:
			salesCount === 0 ? 0 : Math.round(revenueInCents / salesCount),
		itemsSold: Number(row?.itemsSold ?? 0),
	};
}

/** Anything that runs parameterized SQL — `prisma`, or a pg client in scripts. */
export interface RawQueryClient {
	$queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/**
 * Consolidates the restaurant's sales for a calendar period (RN01) with SUM,
 * COUNT and GROUP BY, plus the previous period cut at the same elapsed time.
 */
export async function fetchSalesReport(
	client: RawQueryClient,
	restaurantId: string,
	period: SalesPeriod,
	now: Date = new Date()
) {
	const range = getSalesPeriodRange(period, now);

	const current = [restaurantId, range.start.toISOString(), now.toISOString()];
	const previous = [
		restaurantId,
		range.previousStart.toISOString(),
		range.previousEnd.toISOString(),
	];

	const [kpiRows, previousKpiRows, seriesRows, methodRows, topItemRows] =
		await Promise.all([
			client.$queryRawUnsafe<KpiRow[]>(KPIS_SQL, ...current),
			client.$queryRawUnsafe<KpiRow[]>(KPIS_SQL, ...previous),
			client.$queryRawUnsafe<SeriesRow[]>(
				SERIES_SQL,
				...current,
				range.granularity,
				REPORT_TIME_ZONE,
				BUCKET_FORMAT[range.granularity]
			),
			client.$queryRawUnsafe<MethodRow[]>(BY_METHOD_SQL, ...current),
			client.$queryRawUnsafe<TopItemRow[]>(TOP_ITEMS_SQL, ...current),
		]);

	const seriesByBucket = new Map(seriesRows.map((row) => [row.bucket, row]));
	const series = range.buckets.map(({ key, startsAt }) => {
		// Buckets that haven't started yet have no data (null), so the chart
		// stops at "now" instead of dropping to zero.
		if (startsAt > now) {
			return { bucket: key, startsAt, revenueInCents: null, salesCount: null };
		}

		const row = seriesByBucket.get(key);

		return {
			bucket: key,
			startsAt,
			revenueInCents: Number(row?.revenueInCents ?? 0),
			salesCount: Number(row?.salesCount ?? 0),
		};
	});

	const methodByName = new Map(methodRows.map((row) => [row.method, row]));
	const byPaymentMethod = PAYMENT_METHODS.map((method) => {
		const row = methodByName.get(method);

		return {
			method,
			revenueInCents: Number(row?.revenueInCents ?? 0),
			salesCount: Number(row?.salesCount ?? 0),
		};
	});

	const topItems = topItemRows.map((row) => ({
		menuItemId: row.menuItemId,
		name: row.name,
		quantity: Number(row.quantity),
		revenueInCents: Number(row.revenueInCents),
	}));

	return {
		period,
		granularity: range.granularity,
		generatedAt: now,
		range: { start: range.start, end: range.end },
		comparisonRange: { start: range.previousStart, end: range.previousEnd },
		kpis: toKpis(kpiRows[0]),
		previousKpis: toKpis(previousKpiRows[0]),
		series,
		byPaymentMethod,
		topItems,
	};
}
