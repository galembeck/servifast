import { api } from "../api-client";

interface DeleteMenuItemRequest {
	itemId: string;
	restaurant: string;
}

export async function deleteMenuItem({
	restaurant,
	itemId,
}: DeleteMenuItemRequest) {
	await api.delete(`restaurants/${restaurant}/menu-items/${itemId}`);
}
