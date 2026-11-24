import {
	getSalesPeriodRange,
	REPORT_TIME_ZONE,
	type SalesPeriod,
} from "./sales-period";
import type { RawQueryClient } from "./sales-report";

// Payment.createdAt is a UTC wall time (timestamp without time zone), exactly
// as in the sales report. Each payment is counted once, without cash tender or
// change. settledOn is DATE: never cast it through UTC or use settledAt.
const CASH_FLOW_SQL = `
WITH movements AS (
 SELECT to_char((p.created_at AT TIME ZONE 'UTC') AT TIME ZONE $4, 'YYYY-MM-DD') AS bucket,
        p.amount_in_cents::bigint AS incoming, 0::bigint AS outgoing
 FROM payments p
 WHERE p.restaurant_id = $1
   AND p.created_at >= ($2::timestamptz AT TIME ZONE 'UTC')
   AND p.created_at < ($3::timestamptz AT TIME ZONE 'UTC')
 UNION ALL
 SELECT to_char(e.settled_on, 'YYYY-MM-DD') AS bucket,
        CASE WHEN e.type = 'INCOME' THEN e.amount_in_cents ELSE 0 END::bigint,
        CASE WHEN e.type = 'EXPENSE' THEN e.amount_in_cents ELSE 0 END::bigint
 FROM expenses e
 WHERE e.restaurant_id = $1
   AND ((e.type = 'INCOME' AND e.status = 'RECEIVED') OR (e.type = 'EXPENSE' AND e.status = 'PAID'))
   AND e.settled_on >= ($2::timestamptz AT TIME ZONE $4)::date
   AND e.settled_on <= ($3::timestamptz AT TIME ZONE $4)::date
   AND e.settled_on < ($5::timestamptz AT TIME ZONE $4)::date
)
SELECT bucket, SUM(incoming)::bigint AS "incomingInCents", SUM(outgoing)::bigint AS "outgoingInCents"
FROM movements GROUP BY bucket`;

interface CashFlowRow {
	bucket: string;
	incomingInCents: bigint | number | string;
	outgoingInCents: bigint | number | string;
}

export async function fetchCashFlow(
	client: RawQueryClient,
	restaurantId: string,
	period: SalesPeriod,
	now = new Date()
) {
	const range = getSalesPeriodRange(period, now);
	const rows = await client.$queryRawUnsafe<CashFlowRow[]>(
		CASH_FLOW_SQL,
		restaurantId,
		range.start.toISOString(),
		now.toISOString(),
		REPORT_TIME_ZONE,
		range.end.toISOString()
	);
	const byDay = new Map(rows.map((row) => [row.bucket, row]));
	// A DATE-only settlement cannot be assigned an hour. Reuse the sales calendar
	// but consolidate all sources per day, including a single bucket for today.
	const days = [...new Set(range.buckets.map(({ key }) => key.slice(0, 10)))];
	const series = days.map((bucket) => {
		const row = byDay.get(bucket);
		const incomingInCents = Number(row?.incomingInCents ?? 0);
		const outgoingInCents = Number(row?.outgoingInCents ?? 0);
		return {
			bucket,
			incomingInCents,
			outgoingInCents,
			netInCents: incomingInCents - outgoingInCents,
		};
	});
	// One SQL snapshot supplies both totals and series, including during a
	// concurrent settlement. Their sums cannot drift between separate queries.
	const totals = series.reduce(
		(sum, point) => ({
			incomingInCents: sum.incomingInCents + point.incomingInCents,
			outgoingInCents: sum.outgoingInCents + point.outgoingInCents,
			netInCents: sum.netInCents + point.netInCents,
		}),
		{ incomingInCents: 0, outgoingInCents: 0, netInCents: 0 }
	);
	return {
		period,
		granularity: "day" as const,
		generatedAt: now,
		range: { start: range.start, end: range.end },
		totals,
		series,
	};
}
