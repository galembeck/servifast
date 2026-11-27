import type { BillSplitInput } from "@repo/checkout";
import { api } from "../api-client";
import type { PaymentMethod } from "./close-tab";
export interface InvoicePayment {
	amountInCents: number;
	changeInCents: number | null;
	createdAt: string;
	id: string;
	method: PaymentMethod;
	receivedInCents: number | null;
}
export interface BillInvoice {
	amountInCents: number;
	discountInCents: number | null;
	id: string;
	items: { itemId: string; quantity: number }[];
	name: string;
	payment: InvoicePayment | null;
	position: number;
	serviceFeeInCents: number | null;
	subtotalInCents: number | null;
}
export interface BillSplit {
	amountInCents: number;
	closedAt: string | null;
	discountInCents: number;
	id: string;
	invoices: BillInvoice[];
	mode: "PEOPLE" | "ITEMS" | "PARTIAL";
	paidInCents: number;
	remainingInCents: number;
	serviceFeeInCents: number;
	subtotalInCents: number;
}
export interface SplitPreview {
	fingerprint: string;
	parts: Omit<BillInvoice, "id" | "payment">[];
	totals: {
		subtotalInCents: number;
		serviceFeeInCents: number;
		discountInCents: number;
		amountInCents: number;
	};
}
export type SplitRequest = BillSplitInput & {
	requestId: string;
	previewToken?: string;
};
const path = (restaurant: string, tabId: string) =>
	`restaurants/${restaurant}/tabs/${tabId}/split`;
export function getBillSplit(restaurant: string, tabId: string) {
	return api
		.get(path(restaurant, tabId), { cache: "no-store" })
		.json<{ split: BillSplit | null }>();
}
export function previewBillSplit(
	restaurant: string,
	tabId: string,
	input: SplitRequest
) {
	return api
		.post(`${path(restaurant, tabId)}/preview`, { json: input, retry: 0 })
		.json<{ preview: SplitPreview }>();
}
export function createBillSplit(
	restaurant: string,
	tabId: string,
	input: SplitRequest
) {
	return api
		.post(path(restaurant, tabId), { json: input, retry: 0 })
		.json<{ split: BillSplit }>();
}
export function payBillInvoice(
	restaurant: string,
	tabId: string,
	id: string,
	input: { method: PaymentMethod; receivedInCents?: number }
) {
	return api
		.post(`${path(restaurant, tabId)}/${id}/pay`, { json: input, retry: 0 })
		.json<{ split: BillSplit }>();
}
