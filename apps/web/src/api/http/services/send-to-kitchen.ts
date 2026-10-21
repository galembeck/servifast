import { api } from "../api-client";

interface SendToKitchenRequest {
	restaurant: string;
	tabId: string;
}

interface KdsEventItem {
	id: string;
	name: string;
	notes: string | null;
	productId: string;
	quantity: number;
}

interface SendToKitchenResponse {
	event: {
		id: string;
		sentAt: string;
		tableNumber: number;
		items: KdsEventItem[];
	};
}

export async function sendToKitchen({
	restaurant,
	tabId,
}: SendToKitchenRequest) {
	const result = await api
		.post(`restaurants/${restaurant}/tabs/${tabId}/send-to-kitchen`)
		.json<SendToKitchenResponse>();

	return result;
}
