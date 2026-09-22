import { redirect } from "next/navigation";
import { deleteRestaurant } from "@/api/http/services/delete-restaurant";
import { Button } from "@/components/ui/button";
import { getCurrentRestaurant } from "@/providers/auth-provider";

export function DeleteRestaurantButton() {
	async function deleteRestaurantAction() {
		"use server";

		const currentRestaurant = await getCurrentRestaurant();

		// biome-ignore lint/style/noNonNullAssertion: will always come as a string
		await deleteRestaurant({ restaurant: currentRestaurant! });

		redirect("/");
	}

	return (
		<form action={deleteRestaurantAction}>
			<Button className="w-46" type="submit" variant="destructive">
				Excluir restaurante
			</Button>
		</form>
	);
}
