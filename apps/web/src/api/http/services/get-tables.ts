import { api } from "../api-client";

export type TableStatus = "FREE" | "OCCUPIED" | "BILL_REQUESTED";

interface GetTablesResponse {
	tables: {
		id: string;
		number: number;
		positionReference: string | null;
		seatsCount: number;
		observations: string | null;
		status: TableStatus;
		occupiedSeats: number;
	}[];
}

export async function getTables(slug: string) {
	const result = await api
		.get(`restaurants/${slug}/tables`, {
			next: {
				tags: [`${slug}/tables`],
			},
		})
		.json<GetTablesResponse>();

	return result;
}
