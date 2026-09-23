import { api } from "../api-client";

interface GetMenuCategoriesResponse {
	categories: {
		id: string;
		name: string;
	}[];
}

export async function getMenuCategories(slug: string) {
	const result = await api
		.get(`restaurants/${slug}/menu-categories`, {
			next: {
				tags: [`${slug}/menu-categories`],
			},
		})
		.json<GetMenuCategoriesResponse>();

	return result;
}
