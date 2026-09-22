import { api } from "../api-client";

interface GetRestaurantsResponse {
	restaurants: {
		id: string;
		name: string;
		slug: string;
		avatarUrl: string | null;
	}[];
}

export async function getRestaurants() {
	const result = await api
		.get("restaurants", {
			next: {
				tags: ["restaurants"],
			},
		})
		.json<GetRestaurantsResponse>();

	return result;
}
