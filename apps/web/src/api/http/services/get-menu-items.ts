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

export async function getMenuItems(
	slug: string,
	params?: { available?: boolean; search?: string }
) {
	const searchParams = new URLSearchParams();
	if (params?.available !== undefined) {
		searchParams.set("available", String(params.available));
	}
	if (params?.search) {
		searchParams.set("search", params.search);
	}

	const query = searchParams.toString();
	const result = await api
		.get(`restaurants/${slug}/menu-items${query ? `?${query}` : ""}`, {
			next: {
				tags: [`${slug}/menu-items`],
			},
		})
		.json<GetMenuItemsResponse>();

	return result;
}
