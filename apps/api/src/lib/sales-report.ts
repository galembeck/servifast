import {
	getSalesPeriodRange,
	REPORT_TIME_ZONE,
	type SalesGranularity,
	type SalesPeriod,
} from "./sales-period";

const TOP_ITEMS_LIMIT = 5;
export const TOP_PRODUCTS_LIMIT = 10;
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
ORDER BY "quantity" DESC, "revenueInCents" DESC, mi.name ASC
LIMIT ${TOP_ITEMS_LIMIT}`;

/*
 * Top products among completed services (tabs with a payment), cancelled
 * items excluded. For each product: units, revenue, how many services ordered
 * it and the average ticket of those services (each tab counted once).
 */
const TOP_PRODUCTS_SQL = `
WITH sold AS (
	SELECT
		oi.menu_item_id,
		oi.tab_id,
		oi.quantity,
		oi.quantity * oi.unit_price_in_cents AS revenue,
		p.amount_in_cents AS tab_total
	FROM order_items oi
	JOIN payments p ON p.tab_id = oi.tab_id
	WHERE ${IN_RANGE("p")} AND oi.status <> 'CANCELLED'
),
per_item AS (
	SELECT
		menu_item_id,
		SUM(quantity) AS quantity,
		SUM(revenue) AS revenue,
		COUNT(DISTINCT tab_id) AS services
	FROM sold
	GROUP BY menu_item_id
),
ticket_with_item AS (
	SELECT menu_item_id, ROUND(AVG(tab_total)) AS average_ticket
	FROM (SELECT DISTINCT menu_item_id, tab_id, tab_total FROM sold) AS tabs
	GROUP BY menu_item_id
)
SELECT
	mi.id AS "menuItemId",
	mi.name AS "name",
	mc.name AS "categoryName",
	pi.quantity::int AS "quantity",
	pi.revenue::bigint AS "revenueInCents",
	pi.services::int AS "servicesCount",
	tw.average_ticket::bigint AS "averageTicketWithItemInCents",
	(SELECT COALESCE(SUM(quantity), 0) FROM sold)::int AS "totalUnits"
FROM per_item pi
JOIN menu_items mi ON mi.id = pi.menu_item_id
LEFT JOIN menu_categories mc ON mc.id = mi.category_id
JOIN ticket_with_item tw ON tw.menu_item_id = pi.menu_item_id
ORDER BY pi.quantity DESC, pi.revenue DESC, mi.name ASC
LIMIT ${TOP_PRODUCTS_LIMIT}`;

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

interface TopProductRow {
	averageTicketWithItemInCents: Numeric;
	categoryName: string | null;
	menuItemId: string;
	name: string;
	quantity: number;
	revenueInCents: Numeric;
	servicesCount: number;
	totalUnits: number;
}

/**
 * RN01: average ticket = consolidated revenue / completed services. A period
 * without completed services has no ticket: 0 instead of a division by zero.
 */
export function computeAverageTicket(
	revenueInCents: number,
	completedServices: number
) {
	return completedServices === 0
		? 0
		: Math.round(revenueInCents / completedServices);
}

function toKpis(row: KpiRow | undefined) {
	const revenueInCents = Number(row?.revenueInCents ?? 0);
	const salesCount = Number(row?.salesCount ?? 0);

	return {
		revenueInCents,
		salesCount,
		averageTicketInCents: computeAverageTicket(revenueInCents, salesCount),
		itemsSold: Number(row?.itemsSold ?? 0),
	};
}

/** Anything that runs parameterized SQL — `prisma`, or a pg client in scripts. */
export interface RawQueryClient {
	$queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/**
 * KPIs of completed services (tabs with a payment) between `start` and `end`.
 * Shared by the sales dashboard and the average-ticket report so both always
 * show the same number.
 */
async function fetchSalesKpis(
	client: RawQueryClient,
	restaurantId: string,
	start: Date,
	end: Date
) {
	const rows = await client.$queryRawUnsafe<KpiRow[]>(
		KPIS_SQL,
		restaurantId,
		start.toISOString(),
		end.toISOString()
	);

	return toKpis(rows[0]);
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

	const [kpis, previousKpis, seriesRows, methodRows, topItemRows] =
		await Promise.all([
			fetchSalesKpis(client, restaurantId, range.start, now),
			fetchSalesKpis(
				client,
				restaurantId,
				range.previousStart,
				range.previousEnd
			),
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
		kpis,
		previousKpis,
		series,
		byPaymentMethod,
		topItems,
	};
}

/**
 * Average ticket (RN01) of the period and of the previous period cut at the
 * same elapsed time, with the revenue and service counts behind it.
 */
export async function fetchAverageTicket(
	client: RawQueryClient,
	restaurantId: string,
	period: SalesPeriod,
	now: Date = new Date()
) {
	const range = getSalesPeriodRange(period, now);

	const [current, previous] = await Promise.all([
		fetchSalesKpis(client, restaurantId, range.start, now),
		fetchSalesKpis(
			client,
			restaurantId,
			range.previousStart,
			range.previousEnd
		),
	]);

	const toTicket = (kpis: typeof current) => ({
		averageTicketInCents: kpis.averageTicketInCents,
		revenueInCents: kpis.revenueInCents,
		completedServices: kpis.salesCount,
	});

	return {
		period,
		generatedAt: now,
		range: { start: range.start, end: range.end },
		comparisonRange: { start: range.previousStart, end: range.previousEnd },
		current: toTicket(current),
		previous: toTicket(previous),
	};
}

/** Top 10 products of the period by units sold (RF02, RF03). */
export async function fetchTopProducts(
	client: RawQueryClient,
	restaurantId: string,
	period: SalesPeriod,
	now: Date = new Date()
) {
	const range = getSalesPeriodRange(period, now);

	const rows = await client.$queryRawUnsafe<TopProductRow[]>(
		TOP_PRODUCTS_SQL,
		restaurantId,
		range.start.toISOString(),
		now.toISOString()
	);

	const totalUnits = Number(rows[0]?.totalUnits ?? 0);

	return {
		period,
		generatedAt: now,
		range: { start: range.start, end: range.end },
		totalUnits,
		products: rows.map((row, index) => {
			const quantity = Number(row.quantity);

			return {
				rank: index + 1,
				menuItemId: row.menuItemId,
				name: row.name,
				categoryName: row.categoryName,
				quantity,
				unitsShare: totalUnits === 0 ? 0 : quantity / totalUnits,
				revenueInCents: Number(row.revenueInCents),
				servicesCount: Number(row.servicesCount),
				averageTicketWithItemInCents: Number(row.averageTicketWithItemInCents),
			};
		}),
	};
}
