import { api } from "../api-client";
import type { SalesPeriod } from "./get-sales-report";
export interface CashFlowAmounts {
	incomingInCents: number;
	netInCents: number;
	outgoingInCents: number;
}
export interface CashFlowReport {
	generatedAt: string;
	granularity: "day";
	period: SalesPeriod;
	range: { start: string; end: string };
	series: (CashFlowAmounts & { bucket: string })[];
	totals: CashFlowAmounts;
}
export function getCashFlow(slug: string, period: SalesPeriod) {
	return api
		.get(`restaurants/${slug}/reports/cash-flow`, {
			searchParams: { period },
			cache: "no-store",
		})
		.json<CashFlowReport>();
}
