import type { SalesPeriod } from "@/api/http/services/get-sales-report";

export const SALES_PERIODS: SalesPeriod[] = ["today", "week", "month"];

/** An unknown or missing ?period= falls back to today instead of erroring. */
export function parseSalesPeriod(
	value: string | null | undefined
): SalesPeriod {
	return SALES_PERIODS.includes(value as SalesPeriod)
		? (value as SalesPeriod)
		: "today";
}
