"use client";

import { PackageCheck } from "lucide-react";
import Link from "next/link";
import {
	getStockAlerts,
	type StockAlert,
	type StockAlertFilter,
	type StockAlertsResponse,
} from "@/api/http/services/get-stock-alerts";
import { StockAlertBadge } from "@/components/stock-alert-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useLiveQuery } from "@/hooks/use-live-query";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL_IN_MS = 30_000;

const TIME = new Intl.DateTimeFormat("pt-BR", {
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "America/Sao_Paulo",
});

const EMPTY_MESSAGES: Record<StockAlertFilter, string> = {
	all: "Nenhum produto abaixo do mínimo.",
	critical: "Nenhum produto esgotado.",
	low: "Nenhum produto com estoque baixo.",
};

interface StockAlertsPanelProps {
	filter: StockAlertFilter;
	initialData: StockAlertsResponse;
	slug: string;
}

/** Balance as a share of the minimum, capped at 100%. */
function BalanceBar({ alert }: { alert: StockAlert }) {
	const ratio =
		alert.minStockQuantity === 0
			? 0
			: Math.min(alert.stockQuantity / alert.minStockQuantity, 1);

	return (
		<div aria-hidden className="h-1.5 w-full rounded-full bg-muted">
			<div
				className={cn(
					"h-full rounded-full",
					alert.level === "CRITICAL" ? "bg-destructive" : "bg-amber-400"
				)}
				style={{ width: `${ratio * 100}%` }}
			/>
		</div>
	);
}

export function StockAlertsPanel({
	filter,
	initialData,
	slug,
}: StockAlertsPanelProps) {
	const { data, isOffline } = useLiveQuery({
		queryKey: ["stock-alerts", slug, filter],
		queryFn: () => getStockAlerts(slug, filter),
		serverData: initialData,
		intervalInMs: REFRESH_INTERVAL_IN_MS,
	});

	const { summary, alerts } = data;
	const filters: { count: number; label: string; value: StockAlertFilter }[] = [
		{ value: "all", label: "Todos", count: summary.total },
		{ value: "critical", label: "Crítico (esgotado)", count: summary.critical },
		{ value: "low", label: "Baixo (≤ mínimo)", count: summary.low },
	];

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<nav
					aria-label="Filtrar por saldo × mínimo"
					className="inline-flex flex-wrap rounded-lg border bg-muted/40 p-1"
				>
					{filters.map(({ value, label, count }) => (
						<Link
							aria-current={value === filter ? "page" : undefined}
							className={cn(
								"flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground",
								value === filter && "bg-background text-foreground shadow-sm"
							)}
							href={
								value === "all"
									? `/restaurant/${slug}/stock`
									: `/restaurant/${slug}/stock?nivel=${value}`
							}
							key={value}
						>
							{label}
							<span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
								{count}
							</span>
						</Link>
					))}
				</nav>

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
						: `Atualizado às ${TIME.format(new Date(data.generatedAt))} · atualiza a cada 30 s`}
				</p>
			</div>

			<Card>
				<CardContent>
					{alerts.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground text-sm">
							<PackageCheck aria-hidden className="size-6" />
							<p>{EMPTY_MESSAGES[filter]}</p>
							<p className="text-xs">
								Defina o estoque mínimo dos produtos no Cardápio para receber
								alertas.
							</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Produto</TableHead>
									<TableHead className="text-right">Saldo</TableHead>
									<TableHead className="text-right">Mínimo</TableHead>
									<TableHead className="min-w-32">Saldo × mínimo</TableHead>
									<TableHead className="text-right">Faltam p/ mínimo</TableHead>
									<TableHead>Situação</TableHead>
								</TableRow>
							</TableHeader>

							<TableBody className="tabular-nums">
								{alerts.map((alert) => (
									<TableRow key={alert.menuItemId}>
										<TableCell>
											<p className="font-medium">{alert.name}</p>
											{alert.categoryName && (
												<p className="text-muted-foreground text-xs">
													{alert.categoryName}
												</p>
											)}
										</TableCell>
										<TableCell
											className={cn(
												"text-right font-medium",
												alert.level === "CRITICAL" && "text-destructive"
											)}
										>
											{alert.stockQuantity}
										</TableCell>
										<TableCell className="text-right text-muted-foreground">
											{alert.minStockQuantity}
										</TableCell>
										<TableCell>
											<BalanceBar alert={alert} />
										</TableCell>
										<TableCell className="text-right">
											{alert.missingToMinimum}
										</TableCell>
										<TableCell>
											<StockAlertBadge level={alert.level} />
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
