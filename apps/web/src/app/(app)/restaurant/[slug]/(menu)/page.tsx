import { getMenuCategories } from "@/api/http/services/get-menu-categories";
import { getMenuItems } from "@/api/http/services/get-menu-items";
import { ability, getCurrentRestaurant } from "@/providers/auth-provider";
import { MenuBoard } from "./~components/menu-board";

export default async function RestaurantMenuPage() {
	const permissions = await ability();

	if (!permissions?.can("get", "Menu")) {
		return (
			<div className="space-y-4">
				<h1 className="font-semibold text-2xl">Cardápio (Menu Digital)</h1>

				<p className="text-muted-foreground text-sm">
					Você não tem permissão para ver o cardápio deste restaurante.
				</p>
			</div>
		);
	}

	// biome-ignore lint/style/noNonNullAssertion: always come as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	const [{ categories }, { items }] = await Promise.all([
		getMenuCategories(currentRestaurant),
		getMenuItems(currentRestaurant),
	]);

	return (
		<div className="space-y-4">
			<h1 className="font-semibold text-2xl">Cardápio (Menu Digital)</h1>

			<MenuBoard
				canCreateCategory={!!permissions.can("create", "Menu")}
				canCreateItem={!!permissions.can("create", "Menu")}
				canDeleteItem={!!permissions.can("delete", "Menu")}
				canUpdateItem={!!permissions.can("update", "Menu")}
				categories={categories}
				items={items}
			/>
		</div>
	);
}
