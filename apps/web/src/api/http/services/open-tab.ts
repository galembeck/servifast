import { api } from "../api-client";

interface OpenTabRequest {
	customerName?: string;
	peopleCount?: number;
	restaurant: string;
	tableId: string;
}

interface OpenTabResponse {
	tab: {
		id: string;
		customerName: string | null;
		peopleCount: number | null;
		openedAt: string;
	};
	table: {
		id: string;
		status: "OCCUPIED";
	};
}

export async function openTab({
	restaurant,
	tableId,
	customerName,
	peopleCount,
}: OpenTabRequest) {
	const result = await api
		.post(`restaurants/${restaurant}/tables/${tableId}/open-tab`, {
			json: {
				...(customerName ? { customerName } : {}),
				...(peopleCount === undefined ? {} : { peopleCount }),
			},
		})
		.json<OpenTabResponse>();

	return result;
}
