import { api } from "../api-client";
import type { TableStatus } from "./get-tables";

export interface TableBill {
	cancelledItemsCount: number;
	items: {
		menuItemId: string;
		name: string;
		quantity: number;
		totalInCents: number;
		unitPriceInCents: number;
	}[];
	subtotalInCents: number;
	tab: {
		customerName: string | null;
		id: string;
		openedAt: string;
		peopleCount: number | null;
	};
	table: { id: string; number: number; status: TableStatus };
	unconfirmedItemsCount: number;
}

export async function getTableBill(slug: string, tableId: string) {
	const result = await api
		.get(`restaurants/${slug}/tables/${tableId}/bill`)
		.json<{ bill: TableBill }>();

	return result.bill;
}
