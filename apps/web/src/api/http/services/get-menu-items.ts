import { api } from "../api-client";

interface GetMenuItemsResponse {
	items: {
		categoryId: string;
		description: string | null;
		id: string;
		imageUrl: string | null;
		isAvailable: boolean;
		name: string;
		priceInCents: number;
	}[];
}

export async function getMenuItems(slug: string) {
	const result = await api
		.get(`restaurants/${slug}/menu-items`, {
			next: {
				tags: [`${slug}/menu-items`],
			},
		})
		.json<GetMenuItemsResponse>();

	return result;
}
