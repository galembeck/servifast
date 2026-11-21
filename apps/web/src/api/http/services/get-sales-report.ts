import { api } from "../api-client";

export type SalesPeriod = "today" | "week" | "month";
export type SalesPaymentMethod = "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "PIX";

export interface SalesKpis {
	averageTicketInCents: number;
	itemsSold: number;
	revenueInCents: number;
	salesCount: number;
}

export interface SalesSeriesPoint {
	/** Local bucket key: `YYYY-MM-DD` (day) or `YYYY-MM-DDTHH` (hour). */
	bucket: string;
	/** null for buckets that haven't started yet. */
	revenueInCents: number | null;
	salesCount: number | null;
	startsAt: string;
}

export interface SalesReport {
	byPaymentMethod: {
		method: SalesPaymentMethod;
		revenueInCents: number;
		salesCount: number;
	}[];
	comparisonRange: { start: string; end: string };
	generatedAt: string;
	granularity: "hour" | "day";
	kpis: SalesKpis;
	period: SalesPeriod;
	previousKpis: SalesKpis;
	range: { start: string; end: string };
	series: SalesSeriesPoint[];
	topItems: {
		menuItemId: string;
		name: string;
		quantity: number;
		revenueInCents: number;
	}[];
}

export async function getSalesReport(slug: string, period: SalesPeriod) {
	const result = await api
		.get(`restaurants/${slug}/reports/sales`, {
			searchParams: { period },
			cache: "no-store",
		})
		.json<SalesReport>();

	return result;
}
