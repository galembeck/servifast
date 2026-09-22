import { api } from "../api-client";

interface GetBillingResponse {
	billing: {
		seats: {
			amount: number;
			unit: number;
			price: number;
		};
		projects: {
			amount: number;
			unit: number;
			price: number;
		};
		total: number;
	};
}

export async function getBilling(restaurant: string) {
	const result = await api
		.get(`restaurants/${restaurant}/billing`)
		.json<GetBillingResponse>();

	return result;
}
