import { api } from "../api-client";

export type StockAlertLevel = "CRITICAL" | "LOW";

export type StockAlertFilter = "all" | "critical" | "low";

export interface StockAlert {
	categoryName: string | null;
	level: StockAlertLevel;
	menuItemId: string;
	minStockQuantity: number;
	/** Units needed to get back to the minimum. */
	missingToMinimum: number;
	name: string;
	stockQuantity: number;
}

export interface StockAlertsResponse {
	alerts: StockAlert[];
	filter: StockAlertFilter;
	generatedAt: string;
	summary: { critical: number; low: number; total: number };
}

export async function getStockAlerts(
	slug: string,
	level: StockAlertFilter = "all"
) {
	const result = await api
		.get(`restaurants/${slug}/stock/alerts`, {
			searchParams: { level },
			cache: "no-store",
		})
		.json<StockAlertsResponse>();

	return result;
}
