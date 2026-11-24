import { api } from "../api-client";

export type OrderItemStatus =
	| "RECEIVED"
	| "PREPARING"
	| "READY"
	| "DELIVERED"
	| "CANCELLED";

export interface TabItem {
	createdAt: string;
	deliveredAt: string | null;
	id: string;
	menuItem: {
		id: string;
		name: string;
		imageUrl: string | null;
	};
	notes: string | null;
	quantity: number;
	sentToKitchenAt: string | null;
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
		checkoutLocked: boolean;
		tableId: string;
		table: {
			number: number;
			status: "FREE" | "OCCUPIED" | "BILL_REQUESTED";
		};
		items: TabItem[];
	};
}

export type Tab = GetTabResponse["tab"];

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
