import { api } from "../api-client";

interface CancelTabItemRequest {
	force?: boolean;
	itemId: string;
	restaurant: string;
	tabId: string;
}

interface CancelTabItemResponse {
	forced: boolean;
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
	force = false,
}: CancelTabItemRequest) {
	const result = await api
		.patch(`restaurants/${restaurant}/tabs/${tabId}/items/${itemId}/cancel`, {
			json: force ? { force: true } : undefined,
		})
		.json<CancelTabItemResponse>();

	return result;
}
