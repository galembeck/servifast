import type { CheckoutAdjustments } from "@repo/checkout";
import { api } from "../api-client";
import type { BillSplit } from "./bill-split";
import type { PaymentMethod } from "./close-tab";
export type PartialPaymentRequest = CheckoutAdjustments & {
	requestId: string;
	amountInCents: number;
	method: PaymentMethod;
	receivedInCents?: number;
};
export function registerPartialPayment(
	restaurant: string,
	tabId: string,
	input: PartialPaymentRequest
) {
	return api
		.post(`restaurants/${restaurant}/tabs/${tabId}/partial-payment`, {
			json: input,
			retry: 0,
		})
		.json<{ split: BillSplit }>();
}
