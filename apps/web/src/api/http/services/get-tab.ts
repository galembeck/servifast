import { api } from "../api-client";

export type OrderItemStatus = "RECEIVED";

export interface TabItem {
	createdAt: string;
	id: string;
	menuItem: {
		id: string;
		name: string;
		imageUrl: string | null;
	};
	notes: string | null;
	quantity: number;
	status: OrderItemStatus;
	unitPriceInCents: number;
}

interface GetTabResponse {
	tab: {
		id: string;
		customerName: string | null;
		peopleCount: number | null;
		openedAt: string;
		closedAt: string | null;
		tableId: string;
		items: TabItem[];
	};
}

export async function getTab(slug: string, tabId: string) {
	const result = await api
		.get(`restaurants/${slug}/tabs/${tabId}`, {
			next: {
				tags: [`${slug}/tabs/${tabId}`],
			},
		})
		.json<GetTabResponse>();

	return result;
}
