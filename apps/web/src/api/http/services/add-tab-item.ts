import { api } from "../api-client";

interface AddTabItemRequest {
	menuItemId: string;
	notes?: string;
	quantity: number;
	restaurant: string;
	tabId: string;
}

interface AddTabItemResponse {
	item: {
		id: string;
		quantity: number;
		notes: string | null;
		status: "RECEIVED";
		unitPriceInCents: number;
		createdAt: string;
		menuItemId: string;
		tabId: string;
	};
}

export async function addTabItem({
	restaurant,
	tabId,
	menuItemId,
	quantity,
	notes,
}: AddTabItemRequest) {
	const result = await api
		.post(`restaurants/${restaurant}/tabs/${tabId}/items`, {
			json: {
				menuItemId,
				quantity,
				...(notes ? { notes } : {}),
			},
		})
		.json<AddTabItemResponse>();

	return result;
}
