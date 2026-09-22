import { api } from "../api-client";

interface GetRestaurantResponse {
	restaurant: {
		id: string;
		name: string;
		slug: string;
		domain: string | null;
		shouldAttachUsersByDomain: boolean;
		avatarUrl: string | null;
		createdAt: string;
		updatedAt: string;
		ownerId: string;
	};
}

export async function getRestaurant(slug: string) {
	const result = await api
		.get(`restaurants/${slug}`)
		.json<GetRestaurantResponse>();

	return result;
}
