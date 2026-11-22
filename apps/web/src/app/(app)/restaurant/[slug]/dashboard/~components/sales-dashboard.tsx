"use client";

import { ReceiptText } from "lucide-react";
import Link from "next/link";
import {
	getSalesReport,
	type SalesPeriod,
	type SalesReport,
} from "@/api/http/services/get-sales-report";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useLiveQuery } from "@/hooks/use-live-query";
import { cn } from "@/lib/utils";
import {
	COMPARISON_LABELS,
	formatInteger,
	formatPrice,
	formatTime,
	PERIOD_LABELS,
} from "./format";
import { KpiCard } from "./kpi-card";
import { PaymentMethodChart } from "./payment-method-chart";
import { RevenueChart } from "./revenue-chart";

const REFRESH_INTERVAL_IN_MS = 30_000;

interface SalesDashboardProps {
	initialReport: SalesReport;
	period: SalesPeriod;
	slug: string;
}

const EMPTY_PERIOD_LABELS: Record<SalesPeriod, string> = {
	today: "hoje",
	week: "nesta semana",
	month: "neste mês",
};

function EmptyState({ period }: { period: SalesPeriod }) {
	return (
		<div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground text-sm">
			<ReceiptText aria-hidden className="size-6" />
			<p>Nenhuma venda {EMPTY_PERIOD_LABELS[period]} ainda.</p>
			<p className="text-xs">
				As vendas aparecem aqui quando as comandas são fechadas.
			</p>
		</div>
	);
}

export function SalesDashboard({
	initialReport,
	period,
	slug,
}: SalesDashboardProps) {
	const { data: report, isOffline } = useLiveQuery({
		queryKey: ["sales-report", slug, period],
		queryFn: () => getSalesReport(slug, period),
		serverData: initialReport,
		intervalInMs: REFRESH_INTERVAL_IN_MS,
	});

	const { kpis, previousKpis } = report;
	const comparison = COMPARISON_LABELS[period];
	const hasSales = kpis.salesCount > 0;

	return (
		<div className="space-y-6">
			<p
				aria-live="polite"
				className="flex items-center gap-2 text-muted-foreground text-xs"
			>
				<span
					aria-hidden
					className={cn(
						"size-2 rounded-full",
						isOffline ? "bg-destructive" : "animate-pulse bg-emerald-500"
					)}
				/>
				{isOffline
					? "Sem conexão com o servidor — exibindo os últimos dados."
					: `Atualizado às ${formatTime(report.generatedAt)} · atualiza a cada 30 s`}
			</p>

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<KpiCard
					comparisonLabel={comparison}
					current={kpis.revenueInCents}
					format={formatPrice}
					label="Faturamento"
					previous={previousKpis.revenueInCents}
				/>
				<KpiCard
					comparisonLabel={comparison}
					current={kpis.salesCount}
					format={formatInteger}
					label="Vendas (comandas fechadas)"
					previous={previousKpis.salesCount}
				/>
				<KpiCard
					comparisonLabel={comparison}
					current={kpis.averageTicketInCents}
					format={formatPrice}
					label="Ticket médio"
					previous={previousKpis.averageTicketInCents}
				/>
				<KpiCard
					comparisonLabel={comparison}
					current={kpis.itemsSold}
					format={formatInteger}
					label="Itens vendidos"
					previous={previousKpis.itemsSold}
				/>
			</div>

			<div className="grid items-start gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>
							Faturamento {period === "today" ? "por hora" : "por dia"}
						</CardTitle>
						<CardDescription>{PERIOD_LABELS[period]}</CardDescription>
					</CardHeader>
					<CardContent>
						{hasSales ? (
							<RevenueChart period={period} series={report.series} />
						) : (
							<EmptyState period={period} />
						)}
					</CardContent>
				</Card>

				<div className="grid gap-4">
					<Card>
						<CardHeader>
							<CardTitle>Formas de pagamento</CardTitle>
						</CardHeader>
						<CardContent>
							{hasSales ? (
								<PaymentMethodChart byPaymentMethod={report.byPaymentMethod} />
							) : (
								<p className="text-muted-foreground text-sm">
									Sem vendas no período.
								</p>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-baseline justify-between gap-2">
							<CardTitle>Mais vendidos</CardTitle>
							<Link
								className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
								href={`/restaurant/${slug}/dashboard/products?period=${period}`}
							>
								Ver ranking completo →
							</Link>
						</CardHeader>
						<CardContent>
							{report.topItems.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									Sem vendas no período.
								</p>
							) : (
								<ol className="space-y-2 text-sm">
									{report.topItems.map((item, index) => (
										<li
											className="flex items-baseline gap-3"
											key={item.menuItemId}
										>
											<span className="w-4 text-muted-foreground tabular-nums">
												{index + 1}
											</span>
											<span className="min-w-0 flex-1 truncate">
												{item.name}
											</span>
											<span className="text-muted-foreground tabular-nums">
												{formatInteger(item.quantity)}×
											</span>
											<span className="w-24 text-right tabular-nums">
												{formatPrice(item.revenueInCents)}
											</span>
										</li>
									))}
								</ol>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
