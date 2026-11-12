import { api } from "../api-client";
import type { PaymentMethod } from "./close-tab";

export interface TabReceipt {
	code: string;
	items: {
		menuItemId: string;
		name: string;
		quantity: number;
		totalInCents: number;
		unitPriceInCents: number;
	}[];
	payment: {
		amountInCents: number;
		cashierName: string | null;
		changeInCents: number | null;
		method: PaymentMethod;
		paidAt: string;
		receivedInCents: number | null;
	};
	restaurant: { name: string };
	subtotalInCents: number;
	tab: {
		closedAt: string;
		customerName: string | null;
		openedAt: string;
		peopleCount: number | null;
	};
	table: { number: number };
}

export async function getTabReceipt(slug: string, tabId: string) {
	const result = await api
		.get(`restaurants/${slug}/tabs/${tabId}/receipt`)
		.json<{ receipt: TabReceipt }>();

	return result.receipt;
}
