import { getAverageTicket } from "@/api/http/services/get-average-ticket";
import { getTopProducts } from "@/api/http/services/get-top-products";
import { ability } from "@/providers/auth-provider";
import { NoReportPermission } from "../~components/no-report-permission";
import { parseSalesPeriod } from "../~components/period";
import { ProductsMetrics } from "../~components/products-metrics";

export default async function RestaurantProductsMetricsPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ period?: string }>;
}) {
	const { slug } = await params;
	const permissions = await ability();

	if (!permissions?.can("get", "Report")) {
		return <NoReportPermission />;
	}

	const period = parseSalesPeriod((await searchParams).period);
	const [averageTicket, topProducts] = await Promise.all([
		getAverageTicket(slug, period),
		getTopProducts(slug, period),
	]);

	return (
		<ProductsMetrics
			initialAverageTicket={averageTicket}
			initialTopProducts={topProducts}
			key={period}
			period={period}
			slug={slug}
		/>
	);
}
