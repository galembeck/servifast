import { api } from "../api-client";

interface UpdateMenuItemRequest {
	categoryId: string;
	description: string | null;
	image: File | null;
	isAvailable: boolean;
	itemId: string;
	name: string;
	price: number;
	restaurant: string;
}

export async function updateMenuItem({
	restaurant,
	itemId,
	name,
	description,
	price,
	categoryId,
	isAvailable,
	image,
}: UpdateMenuItemRequest) {
	const formData = new FormData();

	formData.set("name", name);
	formData.set("price", String(price));
	formData.set("categoryId", categoryId);
	formData.set("isAvailable", String(isAvailable));

	if (description) {
		formData.set("description", description);
	}

	if (image) {
		formData.set("image", image);
	}

	await api.put(`restaurants/${restaurant}/menu-items/${itemId}`, {
		body: formData,
	});
}
