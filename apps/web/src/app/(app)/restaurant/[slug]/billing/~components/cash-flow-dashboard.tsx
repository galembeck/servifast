"use client";
import { useQuery } from "@tanstack/react-query";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	type CashFlowReport,
	getCashFlow,
} from "@/api/http/services/get-cash-flow";
import type { SalesPeriod } from "@/api/http/services/get-sales-report";
import { ReportPeriodSelector } from "@/components/report-period-selector";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
	BAR_CURSOR_CLASS,
	CHART_THEME_CLASS,
} from "../../dashboard/~components/chart-theme";
import {
	formatBucketLabel,
	formatBucketTick,
	formatCompactPrice,
	formatPrice,
	formatTime,
} from "../../dashboard/~components/format";

function CashFlowChart({ report }: { report: CashFlowReport }) {
	return (
		<div className="space-y-3">
			<div
				aria-label="Gráfico de entradas e saídas por dia"
				className={cn(
					CHART_THEME_CLASS,
					BAR_CURSOR_CLASS,
					"[&_.cash-flow-outgoing_.recharts-bar-rectangle_path]:fill-destructive"
				)}
				role="img"
				style={{ height: 280 }}
			>
				<ResponsiveContainer height="100%" width="100%">
					<BarChart data={report.series} margin={{ top: 8, right: 8, left: 0 }}>
						<CartesianGrid vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="bucket"
							tickFormatter={(bucket: string) =>
								formatBucketTick(bucket, "month")
							}
							tickLine={false}
						/>
						<YAxis
							axisLine={false}
							tickFormatter={formatCompactPrice}
							tickLine={false}
							width={80}
						/>
						<Tooltip
							formatter={(value) => formatPrice(Number(value))}
							labelFormatter={(label) =>
								formatBucketLabel(String(label), "month")
							}
						/>
						<Legend />
						<Bar
							dataKey="incomingInCents"
							isAnimationActive={false}
							maxBarSize={24}
							name="Entradas"
							radius={[4, 4, 0, 0]}
						/>
						<Bar
							className="cash-flow-outgoing"
							dataKey="outgoingInCents"
							isAnimationActive={false}
							maxBarSize={24}
							name="Saídas"
							radius={[4, 4, 0, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>
			</div>
			<details>
				<summary className="cursor-pointer text-muted-foreground text-xs">
					Ver dados do fluxo em tabela
				</summary>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Dia</TableHead>
							<TableHead>Entradas</TableHead>
							<TableHead>Saídas</TableHead>
							<TableHead>Saldo líquido</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{report.series.map((point) => (
							<TableRow key={point.bucket}>
								<TableCell>{formatBucketTick(point.bucket, "month")}</TableCell>
								<TableCell>{formatPrice(point.incomingInCents)}</TableCell>
								<TableCell>{formatPrice(point.outgoingInCents)}</TableCell>
								<TableCell>{formatPrice(point.netInCents)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</details>
		</div>
	);
}
export function CashFlowDashboard({
	slug,
	period,
}: {
	slug: string;
	period: SalesPeriod;
}) {
	const query = useQuery({
		queryKey: ["cash-flow", slug, period],
		queryFn: () => getCashFlow(slug, period),
		refetchInterval: 30_000,
		retry: false,
	});
	const report = query.data;
	return (
		<section aria-label="Fluxo de caixa consolidado" className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-semibold text-lg">Fluxo de caixa consolidado</h2>
				<ReportPeriodSelector period={period} />
			</div>
			<p className="text-muted-foreground text-sm">
				Vendas e lançamentos baixados, até hoje. Semana a partir de
				segunda-feira; datas de São Paulo.
			</p>
			{query.isPending && <p role="status">Carregando fluxo de caixa...</p>}
			{query.isError && (
				<div className="space-y-2 text-destructive" role="alert">
					<p>Não foi possível carregar o fluxo de caixa.</p>
					<Button
						disabled={query.isFetching}
						onClick={() => query.refetch()}
						type="button"
						variant="outline"
					>
						Tentar novamente
					</Button>
				</div>
			)}
			{!query.isError && report && (
				<>
					<p className="text-muted-foreground text-xs" role="status">
						{query.isFetching
							? "Atualizando fluxo de caixa..."
							: `Atualizado às ${formatTime(report.generatedAt)}`}
					</p>
					<div className="grid gap-4 md:grid-cols-3">
						{[
							["Entradas", report.totals.incomingInCents],
							["Saídas", report.totals.outgoingInCents],
							["Saldo Líquido Consolidado", report.totals.netInCents],
						].map(([label, value]) => (
							<Card key={label}>
								<CardHeader>
									<CardTitle>{label}</CardTitle>
								</CardHeader>
								<CardContent>
									<p
										className={cn(
											"font-semibold text-2xl tabular-nums",
											Number(value) < 0 && "text-destructive"
										)}
									>
										{formatPrice(Number(value))}
									</p>
								</CardContent>
							</Card>
						))}
					</div>
					<Card>
						<CardHeader>
							<CardTitle>Entradas versus saídas</CardTitle>
							<CardDescription>Consolidado por dia</CardDescription>
						</CardHeader>
						<CardContent>
							{report.totals.incomingInCents === 0 &&
							report.totals.outgoingInCents === 0 ? (
								<p className="py-10 text-center text-muted-foreground">
									Nenhuma movimentação no período.
								</p>
							) : (
								<CashFlowChart report={report} />
							)}
						</CardContent>
					</Card>
				</>
			)}
		</section>
	);
}
