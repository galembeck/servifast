import { api } from "../api-client";

interface CreateRestaurant {
	domain: string | null;
	name: string;
	shouldAttachUsersByDomain: boolean;
}

export async function createRestaurant({
	name,
	domain,
	shouldAttachUsersByDomain,
}: CreateRestaurant) {
	await api.post("restaurants", {
		json: {
			name,
			domain,
			shouldAttachUsersByDomain,
		},
	});
}
