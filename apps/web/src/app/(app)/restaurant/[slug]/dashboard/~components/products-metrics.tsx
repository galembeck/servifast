"use client";

import {
	type AverageTicketReport,
	getAverageTicket,
} from "@/api/http/services/get-average-ticket";
import type { SalesPeriod } from "@/api/http/services/get-sales-report";
import {
	getTopProducts,
	type TopProductsReport,
} from "@/api/http/services/get-top-products";
import { useLiveQuery } from "@/hooks/use-live-query";
import { cn } from "@/lib/utils";
import { AverageTicketCard } from "./average-ticket-card";
import { formatTime } from "./format";
import { TopProductsTable } from "./top-products-table";

const REFRESH_INTERVAL_IN_MS = 30_000;

interface ProductsMetricsProps {
	initialAverageTicket: AverageTicketReport;
	initialTopProducts: TopProductsReport;
	period: SalesPeriod;
	slug: string;
}

export function ProductsMetrics({
	initialAverageTicket,
	initialTopProducts,
	period,
	slug,
}: ProductsMetricsProps) {
	const ticket = useLiveQuery({
		queryKey: ["average-ticket", slug, period],
		queryFn: () => getAverageTicket(slug, period),
		serverData: initialAverageTicket,
		intervalInMs: REFRESH_INTERVAL_IN_MS,
	});
	const top = useLiveQuery({
		queryKey: ["top-products", slug, period],
		queryFn: () => getTopProducts(slug, period),
		serverData: initialTopProducts,
		intervalInMs: REFRESH_INTERVAL_IN_MS,
	});

	const isOffline = ticket.isOffline || top.isOffline;

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
					: `Atualizado às ${formatTime(top.data.generatedAt)} · atualiza a cada 30 s`}
			</p>

			<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
				<AverageTicketCard period={period} report={ticket.data} />
				<TopProductsTable
					overallAverageTicketInCents={ticket.data.current.averageTicketInCents}
					products={top.data.products}
					totalUnits={top.data.totalUnits}
				/>
			</div>
		</div>
	);
}
