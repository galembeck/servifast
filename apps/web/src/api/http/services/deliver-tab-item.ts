import { api } from "../api-client";

interface DeliverTabItemRequest {
	itemId: string;
	restaurant: string;
	tabId: string;
}

interface DeliverTabItemResponse {
	item: {
		id: string;
		status: "DELIVERED";
		deliveredAt: string;
	};
}

export async function deliverTabItem({
	itemId,
	restaurant,
	tabId,
}: DeliverTabItemRequest) {
	const result = await api
		.patch(`restaurants/${restaurant}/tabs/${tabId}/items/${itemId}/deliver`)
		.json<DeliverTabItemResponse>();

	return result;
}
