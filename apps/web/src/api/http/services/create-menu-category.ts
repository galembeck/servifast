import { api } from "../api-client";

interface CreateMenuCategoryRequest {
	name: string;
	restaurant: string;
}

export async function createMenuCategory({
	restaurant,
	name,
}: CreateMenuCategoryRequest) {
	await api.post(`restaurants/${restaurant}/menu-categories`, {
		json: {
			name,
		},
	});
}
