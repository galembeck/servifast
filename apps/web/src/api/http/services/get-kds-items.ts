import { api } from "../api-client";

export type KdsItemStatus = "RECEIVED" | "CANCELLED";

export interface KdsItem {
	id: string;
	notes: string | null;
	productId: string;
	productName: string;
	quantity: number;
	sentToKitchenAt: string;
	status: KdsItemStatus;
	tabClosedAt: string | null;
	tabId: string;
	table: {
		number: number;
		positionReference: string | null;
	};
}

export interface GetKdsItemsResponse {
	items: KdsItem[];
	serverTime: string;
}

export async function getKdsItems(slug: string, since?: string) {
	const result = await api
		.get(`restaurants/${slug}/kds/items`, {
			searchParams: since ? { since } : undefined,
		})
		.json<GetKdsItemsResponse>();

	return result;
}
