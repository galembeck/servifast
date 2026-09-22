import { api } from "../api-client";

interface GetProjectsResponse {
	projects: {
		id: string;
		description: string;
		name: string;
		slug: string;
		avatarUrl: string | null;
		restaurantId: string;
		ownerId: string;
		createdAt: string;
		owner: {
			id: string;
			name: string | null;
			avatarUrl: string | null;
		};
	}[];
}

export async function getProjects(restaurantSlug: string) {
	const result = await api
		.get(`restaurants/${restaurantSlug}/projects`, {
			next: {
				tags: [`${restaurantSlug}/projects`],
			},
		})
		.json<GetProjectsResponse>();

	return result;
}
