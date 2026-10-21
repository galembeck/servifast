import { api } from "../api-client";

interface CancelTabItemRequest {
	itemId: string;
	restaurant: string;
	tabId: string;
}

interface CancelTabItemResponse {
	item: {
		id: string;
		quantity: number;
		notes: string | null;
		status: "CANCELLED";
		unitPriceInCents: number;
		createdAt: string;
		updatedAt: string;
		menuItemId: string;
		tabId: string;
	};
}

export async function cancelTabItem({
	restaurant,
	tabId,
	itemId,
}: CancelTabItemRequest) {
	const result = await api
		.patch(`restaurants/${restaurant}/tabs/${tabId}/items/${itemId}/cancel`)
		.json<CancelTabItemResponse>();

	return result;
}
