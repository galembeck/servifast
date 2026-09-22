import { api } from "../api-client";

interface UpdateRestaurant {
	domain: string | null;
	name: string;
	restaurant: string;
	shouldAttachUsersByDomain: boolean;
}

export async function updateRestaurant({
	restaurant,
	name,
	domain,
	shouldAttachUsersByDomain,
}: UpdateRestaurant) {
	await api.put(`restaurants/${restaurant}`, {
		json: {
			name,
			domain,
			shouldAttachUsersByDomain,
		},
	});
}
