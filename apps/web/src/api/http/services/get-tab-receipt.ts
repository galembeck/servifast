import { api } from "../api-client";
import type { PaymentMethod } from "./close-tab";

export interface TabReceipt {
	code: string;
	discountInCents: number;
	items: {
		menuItemId: string;
		name: string;
		quantity: number;
		totalInCents: number;
		unitPriceInCents: number;
	}[];
	payment: ReceiptPayment | null;
	payments: ReceiptPayment[];
	restaurant: { name: string };
	serviceFeeInCents: number;
	subtotalInCents: number;
	tab: {
		closedAt: string;
		customerName: string | null;
		openedAt: string;
		peopleCount: number | null;
	};
	table: { number: number };
	totalInCents: number;
}

export async function getTabReceipt(slug: string, tabId: string) {
	const result = await api
		.get(`restaurants/${slug}/tabs/${tabId}/receipt`)
		.json<{ receipt: TabReceipt }>();

	return result.receipt;
}

export interface ReceiptPayment {
	amountInCents: number;
	cashierName: string | null;
	changeInCents: number | null;
	id: string;
	invoiceName: string | null;
	invoicePosition: number | null;
	method: PaymentMethod;
	paidAt: string;
	receivedInCents: number | null;
}
