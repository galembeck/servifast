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
	stockQuantity?: number | null;
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
	stockQuantity,
}: UpdateMenuItemRequest) {
	const formData = new FormData();

	formData.set("name", name);
	formData.set("price", String(price));
	formData.set("categoryId", categoryId);
	formData.set("isAvailable", String(isAvailable));

	// Missing keeps the current balance; empty string stops tracking stock.
	if (stockQuantity !== undefined) {
		formData.set(
			"stockQuantity",
			stockQuantity === null ? "" : String(stockQuantity)
		);
	}

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
