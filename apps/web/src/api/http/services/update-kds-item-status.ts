import { api } from "../api-client";

export type KitchenTargetStatus = "PREPARING" | "READY";

interface UpdateKdsItemStatusRequest {
	itemId: string;
	restaurant: string;
	status: KitchenTargetStatus;
}

interface UpdateKdsItemStatusResponse {
	item: {
		id: string;
		status: KitchenTargetStatus;
		updatedAt: string;
	};
}

export async function updateKdsItemStatus({
	itemId,
	restaurant,
	status,
}: UpdateKdsItemStatusRequest) {
	const result = await api
		.patch(`restaurants/${restaurant}/kds/items/${itemId}/status`, {
			json: { status },
		})
		.json<UpdateKdsItemStatusResponse>();

	return result;
}
