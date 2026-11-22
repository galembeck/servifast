import type { RawQueryClient } from "./sales-report";

export const STOCK_ALERT_LEVELS = ["CRITICAL", "LOW"] as const;

export type StockAlertLevel = (typeof STOCK_ALERT_LEVELS)[number];

export const STOCK_ALERT_FILTERS = ["all", "critical", "low"] as const;

export type StockAlertFilter = (typeof STOCK_ALERT_FILTERS)[number];

/**
 * RN01: balance × minimum, compared in the database. Only items that track
 * stock and have a minimum take part. A sold-out item (balance 0) is CRITICAL;
 * any other balance at or below the minimum is LOW. Critical first, then the
 * items furthest below their minimum.
 */
export const STOCK_ALERTS_SQL = `
SELECT
	mi.id AS "menuItemId",
	mi.name AS "name",
	mc.name AS "categoryName",
	mi.stock_quantity AS "stockQuantity",
	mi.min_stock_quantity AS "minStockQuantity",
	CASE WHEN mi.stock_quantity <= 0 THEN 'CRITICAL' ELSE 'LOW' END AS "level"
FROM menu_items mi
LEFT JOIN menu_categories mc ON mc.id = mi.category_id
WHERE mi.restaurant_id = $1
	AND mi.stock_quantity IS NOT NULL
	AND mi.min_stock_quantity IS NOT NULL
	AND mi.stock_quantity <= mi.min_stock_quantity
ORDER BY
	(mi.stock_quantity <= 0) DESC,
	mi.stock_quantity::numeric / NULLIF(mi.min_stock_quantity, 0) ASC NULLS FIRST,
	mi.name ASC
`;

interface StockAlertRow {
	categoryName: string | null;
	level: string;
	menuItemId: string;
	minStockQuantity: number | bigint;
	name: string;
	stockQuantity: number | bigint;
}

const FILTER_LEVEL: Record<StockAlertFilter, StockAlertLevel | null> = {
	all: null,
	critical: "CRITICAL",
	low: "LOW",
};

export async function fetchStockAlerts(
	client: RawQueryClient,
	restaurantId: string,
	filter: StockAlertFilter,
	now = new Date()
) {
	const rows = await client.$queryRawUnsafe<StockAlertRow[]>(
		STOCK_ALERTS_SQL,
		restaurantId
	);

	const alerts = rows.map((row) => {
		const stockQuantity = Number(row.stockQuantity);
		const minStockQuantity = Number(row.minStockQuantity);

		return {
			menuItemId: row.menuItemId,
			name: row.name,
			categoryName: row.categoryName,
			stockQuantity,
			minStockQuantity,
			level: (row.level === "CRITICAL" ? "CRITICAL" : "LOW") as StockAlertLevel,
			/** Units needed to get back to the minimum. */
			missingToMinimum: Math.max(minStockQuantity - stockQuantity, 0),
		};
	});

	const critical = alerts.filter((alert) => alert.level === "CRITICAL").length;
	const level = FILTER_LEVEL[filter];

	return {
		generatedAt: now,
		filter,
		summary: {
			total: alerts.length,
			critical,
			low: alerts.length - critical,
		},
		alerts: level ? alerts.filter((alert) => alert.level === level) : alerts,
	};
}
