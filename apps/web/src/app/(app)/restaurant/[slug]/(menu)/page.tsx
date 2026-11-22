import { redirect } from "next/navigation";
import { getMenuCategories } from "@/api/http/services/get-menu-categories";
import { getMenuItems } from "@/api/http/services/get-menu-items";
import { ability, getCurrentRestaurant } from "@/providers/auth-provider";
import { MenuBoard } from "./~components/menu-board";

type Permissions = NonNullable<Awaited<ReturnType<typeof ability>>>;

/**
 * `/restaurant/:slug` is everyone's entry point (restaurant switcher, invite,
 * sign-in). For roles that can't see the menu, the first screen they can use,
 * in order of what that role does first.
 */
function getFallbackHomePath(slug: string, permissions: Permissions) {
	const candidates: [boolean, string][] = [
		[permissions.can("get", "Report"), "dashboard"],
		[permissions.can("get", "Shift"), "cash-register"],
		[permissions.can("get", "Table"), "tables"],
		[permissions.can("update", "Order"), "kds"],
		[permissions.can("get", "Billing"), "billing"],
	];

	const match = candidates.find(([allowed]) => allowed);

	return match ? `/restaurant/${slug}/${match[1]}` : null;
}

export default async function RestaurantMenuPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const permissions = await ability();

	if (permissions && !permissions.can("get", "Menu")) {
		const fallbackPath = getFallbackHomePath(slug, permissions);

		if (fallbackPath) {
			redirect(fallbackPath);
		}
	}

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
