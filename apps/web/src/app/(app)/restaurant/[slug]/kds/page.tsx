import { getKdsItems } from "@/api/http/services/get-kds-items";
import { ability, getCurrentRestaurant } from "@/providers/auth-provider";
import { KdsBoard } from "./~components/kds-board";

export default async function KdsPage() {
	const permissions = await ability();

	if (!permissions?.can("update", "Order")) {
		return (
			<div className="space-y-4">
				<h1 className="font-semibold text-2xl">Cozinha</h1>
				<p className="text-muted-foreground text-sm">
					Você não tem permissão para ver a fila da cozinha deste restaurante.
				</p>
			</div>
		);
	}

	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	const queue = await getKdsItems(currentRestaurant);

	return <KdsBoard currentRestaurant={currentRestaurant} queue={queue} />;
}
