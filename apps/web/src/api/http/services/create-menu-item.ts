import { api } from "../api-client";

interface CreateMenuItemRequest {
	categoryId: string;
	description: string | null;
	image: File | null;
	name: string;
	price: number;
	restaurant: string;
	stockQuantity?: number | null;
}

export async function createMenuItem({
	restaurant,
	name,
	description,
	price,
	categoryId,
	image,
	stockQuantity,
}: CreateMenuItemRequest) {
	const formData = new FormData();

	formData.set("name", name);
	formData.set("price", String(price));
	formData.set("categoryId", categoryId);

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

	await api.post(`restaurants/${restaurant}/menu-items`, {
		body: formData,
	});
}
