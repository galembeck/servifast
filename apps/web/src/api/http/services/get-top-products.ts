import { api } from "../api-client";
import type { SalesPeriod } from "./get-sales-report";

export interface TopProduct {
	averageTicketWithItemInCents: number;
	categoryName: string | null;
	menuItemId: string;
	name: string;
	quantity: number;
	rank: number;
	revenueInCents: number;
	servicesCount: number;
	/** 0–1 share of all units sold in the period. */
	unitsShare: number;
}

export interface TopProductsReport {
	generatedAt: string;
	period: SalesPeriod;
	products: TopProduct[];
	range: { start: string; end: string };
	totalUnits: number;
}

export async function getTopProducts(slug: string, period: SalesPeriod) {
	const result = await api
		.get(`restaurants/${slug}/reports/top-products`, {
			searchParams: { period },
			cache: "no-store",
		})
		.json<TopProductsReport>();

	return result;
}
