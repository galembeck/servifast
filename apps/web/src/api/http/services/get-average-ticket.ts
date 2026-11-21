import { api } from "../api-client";
import type { SalesPeriod } from "./get-sales-report";

export interface AverageTicketFigures {
	averageTicketInCents: number;
	completedServices: number;
	revenueInCents: number;
}

export interface AverageTicketReport {
	comparisonRange: { start: string; end: string };
	current: AverageTicketFigures;
	generatedAt: string;
	period: SalesPeriod;
	previous: AverageTicketFigures;
	range: { start: string; end: string };
}

export async function getAverageTicket(slug: string, period: SalesPeriod) {
	const result = await api
		.get(`restaurants/${slug}/reports/average-ticket`, {
			searchParams: { period },
			cache: "no-store",
		})
		.json<AverageTicketReport>();

	return result;
}
