import type { CheckoutAdjustments } from "@repo/checkout";
import { api } from "../api-client";

export type PaymentMethod = "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "PIX";

interface CloseTabRequest extends CheckoutAdjustments {
	method: PaymentMethod;
	receivedInCents?: number;
	requestId?: string;
	restaurant: string;
	tabId: string;
}

interface CloseTabResponse {
	payment: {
		id: string;
		method: PaymentMethod;
		amountInCents: number;
		receivedInCents: number | null;
		changeInCents: number | null;
		createdAt: string;
	};
	tab: { id: string; closedAt: string };
	table: { id: string; status: "FREE" };
}

export async function closeTab({
	method,
	requestId,
	receivedInCents,
	serviceFee,
	discount,
	restaurant,
	tabId,
}: CloseTabRequest) {
	const result = await api
		.post(`restaurants/${restaurant}/tabs/${tabId}/close`, {
			json: { method, requestId, receivedInCents, serviceFee, discount },
		})
		.json<CloseTabResponse>();

	return result;
}
