"use client";

import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type {
	SalesPeriod,
	SalesSeriesPoint,
} from "@/api/http/services/get-sales-report";
import { cn } from "@/lib/utils";
import {
	BAR_CURSOR_CLASS,
	CHART_THEME_CLASS,
	LINE_CURSOR_CLASS,
} from "./chart-theme";
import {
	formatBucketLabel,
	formatBucketTick,
	formatCompactPrice,
	formatInteger,
	formatPrice,
} from "./format";

const AXIS_TEXT = { fontSize: 12 };
const CHART_HEIGHT = 280;
const MAX_BAR_SIZE = 24;
const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

interface ChartTooltipProps {
	active?: boolean;
	payload?: { payload: SalesSeriesPoint }[];
	period: SalesPeriod;
}

function ChartTooltip({ active, payload, period }: ChartTooltipProps) {
	const point = payload?.[0]?.payload;

	if (!(active && point) || point.revenueInCents === null) {
		return null;
	}

	return (
		<div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground text-xs shadow-md">
			<p className="mb-1 font-medium">
				{formatBucketLabel(point.bucket, period)}
			</p>
			<p className="flex items-center gap-2">
				<span aria-hidden className="size-2 rounded-full bg-chart-sales" />
				<span className="text-muted-foreground">Faturamento</span>
				<span className="ml-auto font-medium tabular-nums">
					{formatPrice(point.revenueInCents)}
				</span>
			</p>
			<p className="mt-0.5 pl-4 text-muted-foreground">
				{formatInteger(point.salesCount ?? 0)}{" "}
				{point.salesCount === 1 ? "venda" : "vendas"}
			</p>
		</div>
	);
}

interface RevenueChartProps {
	period: SalesPeriod;
	series: SalesSeriesPoint[];
}

export function RevenueChart({ period, series }: RevenueChartProps) {
	const isHourly = period === "today";
	const pastPoints = series.filter((point) => point.revenueInCents !== null);

	const axes = (
		<>
			<CartesianGrid strokeWidth={1} vertical={false} />
			<XAxis
				axisLine={false}
				dataKey="bucket"
				interval="preserveStartEnd"
				minTickGap={16}
				tick={AXIS_TEXT}
				tickFormatter={(bucket: string) => formatBucketTick(bucket, period)}
				tickLine={false}
			/>
			<YAxis
				axisLine={false}
				tick={AXIS_TEXT}
				tickFormatter={(value: number) => formatCompactPrice(value)}
				tickLine={false}
				width={72}
			/>
			<Tooltip
				content={<ChartTooltip period={period} />}
				cursor={isHourly ? { strokeWidth: 1 } : true}
			/>
		</>
	);

	return (
		<div className="space-y-3">
			<div
				aria-label="Gráfico de faturamento do período"
				className={cn(
					CHART_THEME_CLASS,
					isHourly ? LINE_CURSOR_CLASS : BAR_CURSOR_CLASS
				)}
				role="img"
				style={{ height: CHART_HEIGHT }}
			>
				<ResponsiveContainer height="100%" width="100%">
					{isHourly ? (
						<LineChart data={series} margin={{ top: 8, right: 8, left: 0 }}>
							{axes}
							<Line
								activeDot={{ r: 5, strokeWidth: 2 }}
								connectNulls={false}
								dataKey="revenueInCents"
								dot={false}
								isAnimationActive={false}
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								type="monotone"
							/>
						</LineChart>
					) : (
						<BarChart data={series} margin={{ top: 8, right: 8, left: 0 }}>
							{axes}
							<Bar
								dataKey="revenueInCents"
								isAnimationActive={false}
								maxBarSize={MAX_BAR_SIZE}
								radius={BAR_RADIUS}
							/>
						</BarChart>
					)}
				</ResponsiveContainer>
			</div>

			<details className="text-sm">
				<summary className="cursor-pointer text-muted-foreground text-xs">
					Ver dados em tabela
				</summary>
				<table className="mt-2 w-full text-xs">
					<thead className="text-muted-foreground">
						<tr>
							<th className="py-1 text-left font-normal">
								{isHourly ? "Hora" : "Dia"}
							</th>
							<th className="py-1 text-right font-normal">Vendas</th>
							<th className="py-1 text-right font-normal">Faturamento</th>
						</tr>
					</thead>
					<tbody className="tabular-nums">
						{pastPoints.map((point) => (
							<tr className="border-t" key={point.bucket}>
								<td className="py-1">
									{formatBucketLabel(point.bucket, period)}
								</td>
								<td className="py-1 text-right">
									{formatInteger(point.salesCount ?? 0)}
								</td>
								<td className="py-1 text-right">
									{formatPrice(point.revenueInCents ?? 0)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
		</div>
	);
}
