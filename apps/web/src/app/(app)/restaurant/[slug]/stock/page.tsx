import {
	getStockAlerts,
	type StockAlertFilter,
} from "@/api/http/services/get-stock-alerts";
import { ability } from "@/providers/auth-provider";
import { StockAlertsPanel } from "./~components/stock-alerts-panel";

const FILTERS: StockAlertFilter[] = ["all", "critical", "low"];

function parseFilter(value: string | undefined): StockAlertFilter {
	return FILTERS.find((filter) => filter === value) ?? "all";
}

export default async function RestaurantStockPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ nivel?: string }>;
}) {
	const { slug } = await params;
	const permissions = await ability();

	if (!permissions?.can("get", "Stock")) {
		return (
			<div className="space-y-4">
				<h1 className="font-semibold text-2xl">Estoque</h1>
				<p className="text-muted-foreground text-sm">
					Você não tem permissão para ver os alertas de estoque deste
					restaurante.
				</p>
			</div>
		);
	}

	const filter = parseFilter((await searchParams).nivel);
	const initialData = await getStockAlerts(slug, filter);

	return (
		<div className="space-y-6">
			<div className="space-y-1">
				<h1 className="font-semibold text-2xl">Estoque</h1>
				<p className="text-muted-foreground text-sm">
					Produtos com saldo no mínimo ou abaixo dele. O saldo e o mínimo de
					cada produto são definidos no Cardápio.
				</p>
			</div>

			<StockAlertsPanel
				filter={filter}
				initialData={initialData}
				key={filter}
				slug={slug}
			/>
		</div>
	);
}
