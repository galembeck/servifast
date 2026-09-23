import { getRestaurant } from "@/api/http/services/get-restaurant";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ability, getCurrentRestaurant } from "@/providers/auth-provider";
import { RestaurantForm } from "../../~components/restaurant-form";
import { Billing } from "./~components/billing";
import { DeleteRestaurantButton } from "./~components/delete-restaurant-button";

export default async function RestaurantSettingsPage() {
	const currentRestaurant = await getCurrentRestaurant();

	const permissions = await ability();

	const canUpdateRestaurant = permissions?.can("update", "Restaurant");
	const canGetBillingDetails = permissions?.can("get", "Billing");

	const canDeleteRestaurant = permissions?.can("delete", "Restaurant");

	// biome-ignore lint/style/noNonNullAssertion: always come as a string
	const { restaurant } = await getRestaurant(currentRestaurant!);

	return (
		<div className="space-y-4">
			<h1 className="font-semibold text-2xl">Configurações</h1>

			<div className="space-y-4">
				{canUpdateRestaurant && (
					<Card>
						<CardHeader>
							<CardTitle>Configurações do restaurante</CardTitle>

							<CardDescription>
								Atualize as configurações/detalhes do seu restaurante.
							</CardDescription>
						</CardHeader>

						<CardContent>
							<RestaurantForm
								initialData={{
									name: restaurant.name,
									domain: restaurant.domain,
									shouldAttachUsersByDomain:
										restaurant.shouldAttachUsersByDomain,
								}}
								isUpdating
							/>
						</CardContent>
					</Card>
				)}

				{canGetBillingDetails && <Billing />}

				{canDeleteRestaurant && (
					<Card className="flex w-full flex-row items-center justify-between">
						<CardHeader className="w-full">
							<CardTitle>Excluir restaurante</CardTitle>

							<CardDescription>
								Isso excluirá todos os dados do restaurante. Essa ação não pode
								ser desfeita.
							</CardDescription>
						</CardHeader>

						<CardContent>
							<DeleteRestaurantButton />
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
