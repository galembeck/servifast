import { api } from "../api-client";
export interface FinancialEntry {
	amountInCents: number;
	category: string;
	id: string;
	settledAt: string | null;
	settledOn: string | null;
	status: "LEGACY" | "PENDING" | "PAID" | "RECEIVED";
	type: "EXPENSE" | "INCOME";
}
export function getFinancialEntries(restaurant: string) {
	return api
		.get(`restaurants/${restaurant}/financial-entries`, { cache: "no-store" })
		.json<{ entries: FinancialEntry[] }>();
}
export function payFinancialEntry(
	restaurant: string,
	id: string,
	effectiveDate: string
) {
	return api
		.patch(`restaurants/${restaurant}/financial-entries/${id}/pay`, {
			json: { effectiveDate },
			retry: 0,
		})
		.json<{ entry: FinancialEntry }>();
}
