import { ability } from "@/providers/auth-provider";
import { CreateTableSheet } from "./~components/create-table-sheet";
import { TableGrid } from "./~components/table-grid";

export default async function RestaurantTablesPage() {
	const permissions = await ability();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="font-semibold text-2xl">Mesas</h1>

				{permissions?.can("create", "Table") && <CreateTableSheet />}
			</div>

			{permissions?.can("get", "Table") ? (
				<TableGrid />
			) : (
				<p className="text-muted-foreground text-sm">
					Você não tem permissão para ver as mesas deste restaurante.
				</p>
			)}
		</div>
	);
}
