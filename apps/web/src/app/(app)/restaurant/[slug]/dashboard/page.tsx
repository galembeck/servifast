import Link from "next/link";
import {
	getSalesReport,
	type SalesPeriod,
} from "@/api/http/services/get-sales-report";
import { cn } from "@/lib/utils";
import { ability } from "@/providers/auth-provider";
import { PERIOD_LABELS } from "./~components/format";
import { SalesDashboard } from "./~components/sales-dashboard";

const PERIODS: SalesPeriod[] = ["today", "week", "month"];

function isSalesPeriod(value: string | undefined): value is SalesPeriod {
	return PERIODS.includes(value as SalesPeriod);
}

export default async function RestaurantDashboardPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ period?: string }>;
}) {
	const { slug } = await params;
	const { period: requestedPeriod } = await searchParams;
	const permissions = await ability();

	if (!permissions?.can("get", "Report")) {
		return (
			<div className="space-y-4">
				<h1 className="font-semibold text-2xl">Dashboard de vendas</h1>
				<p className="text-muted-foreground text-sm">
					Você não tem permissão para ver os relatórios deste restaurante.
				</p>
			</div>
		);
	}

	// An unknown ?period= falls back to today instead of erroring.
	const period = isSalesPeriod(requestedPeriod) ? requestedPeriod : "today";
	const report = await getSalesReport(slug, period);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<h1 className="font-semibold text-2xl">Dashboard de vendas</h1>

				<nav
					aria-label="Período"
					className="inline-flex rounded-lg border bg-muted/40 p-1"
				>
					{PERIODS.map((option) => (
						<Link
							aria-current={option === period ? "page" : undefined}
							className={cn(
								"rounded-md px-4 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground",
								option === period && "bg-background text-foreground shadow-sm"
							)}
							href={`/restaurant/${slug}/dashboard?period=${option}`}
							key={option}
							scroll={false}
						>
							{PERIOD_LABELS[option]}
						</Link>
					))}
				</nav>
			</div>

			<SalesDashboard
				initialReport={report}
				key={period}
				period={period}
				slug={slug}
			/>
		</div>
	);
}
