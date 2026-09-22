import { api } from "../api-client";

interface DeleteRestaurantRequest {
	restaurant: string;
}

export async function deleteRestaurant({
	restaurant,
}: DeleteRestaurantRequest) {
	await api.delete(`restaurants/${restaurant}`);
}
