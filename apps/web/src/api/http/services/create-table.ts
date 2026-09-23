import { api } from "../api-client";

interface CreateTableRequest {
	number: number;
	observations: string | null;
	positionReference: string | null;
	restaurant: string;
	seatsCount: number;
}

export async function createTable({
	restaurant,
	number,
	positionReference,
	seatsCount,
	observations,
}: CreateTableRequest) {
	await api.post(`restaurants/${restaurant}/tables`, {
		json: {
			number,
			positionReference,
			seatsCount,
			observations,
		},
	});
}
