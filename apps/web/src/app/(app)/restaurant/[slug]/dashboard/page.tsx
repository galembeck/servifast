import { getSalesReport } from "@/api/http/services/get-sales-report";
import { ability } from "@/providers/auth-provider";
import { NoReportPermission } from "./~components/no-report-permission";
import { parseSalesPeriod } from "./~components/period";
import { SalesDashboard } from "./~components/sales-dashboard";

export default async function RestaurantDashboardPage({
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
	const report = await getSalesReport(slug, period);

	return (
		<SalesDashboard
			initialReport={report}
			key={period}
			period={period}
			slug={slug}
		/>
	);
}
