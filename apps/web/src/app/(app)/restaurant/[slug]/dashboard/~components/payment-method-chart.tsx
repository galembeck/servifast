"use client";

import {
	Bar,
	BarChart,
	LabelList,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { SalesReport } from "@/api/http/services/get-sales-report";
import { cn } from "@/lib/utils";
import { BAR_CURSOR_CLASS, CHART_THEME_CLASS } from "./chart-theme";
import { formatInteger, formatPrice, PAYMENT_METHOD_LABELS } from "./format";

const BAR_SIZE = 20;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 72;
const VALUE_LABEL_SPACE = 96;

type MethodRow = SalesReport["byPaymentMethod"][number] & { label: string };

interface MethodTooltipProps {
	active?: boolean;
	payload?: { payload: MethodRow }[];
	totalInCents: number;
}

function MethodTooltip({ active, payload, totalInCents }: MethodTooltipProps) {
	const row = payload?.[0]?.payload;

	if (!(active && row)) {
		return null;
	}

	const share =
		totalInCents === 0
			? 0
			: Math.round((row.revenueInCents / totalInCents) * 100);

	return (
		<div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground text-xs shadow-md">
			<p className="mb-1 font-medium">{row.label}</p>
			<p className="tabular-nums">
				{formatPrice(row.revenueInCents)}{" "}
				<span className="text-muted-foreground">({share}% do faturamento)</span>
			</p>
			<p className="text-muted-foreground tabular-nums">
				{formatInteger(row.salesCount)}{" "}
				{row.salesCount === 1 ? "venda" : "vendas"}
			</p>
		</div>
	);
}

interface PaymentMethodChartProps {
	byPaymentMethod: SalesReport["byPaymentMethod"];
}

/**
 * One measure across four categories, so a single color: the method name on
 * the axis carries identity, and each bar is direct-labeled with its value.
 */
export function PaymentMethodChart({
	byPaymentMethod,
}: PaymentMethodChartProps) {
	const rows: MethodRow[] = byPaymentMethod.map((row) => ({
		...row,
		label: PAYMENT_METHOD_LABELS[row.method],
	}));
	const totalInCents = rows.reduce(
		(total, row) => total + row.revenueInCents,
		0
	);

	return (
		<div
			aria-label="Faturamento por forma de pagamento"
			className={cn(
				CHART_THEME_CLASS,
				BAR_CURSOR_CLASS,
				// Method names are the category labels: full-strength text.
				"[&_.recharts-yAxis_.recharts-cartesian-axis-tick_text]:fill-foreground"
			)}
			role="img"
			style={{ height: rows.length * ROW_HEIGHT }}
		>
			<ResponsiveContainer height="100%" width="100%">
				<BarChart
					data={rows}
					layout="vertical"
					margin={{ top: 0, right: VALUE_LABEL_SPACE, bottom: 0, left: 0 }}
				>
					<XAxis dataKey="revenueInCents" hide type="number" />
					<YAxis
						axisLine={false}
						dataKey="label"
						tick={{ fontSize: 13 }}
						tickLine={false}
						type="category"
						width={LABEL_WIDTH}
					/>
					<Tooltip content={<MethodTooltip totalInCents={totalInCents} />} />
					<Bar
						barSize={BAR_SIZE}
						dataKey="revenueInCents"
						isAnimationActive={false}
						minPointSize={2}
						radius={[0, 4, 4, 0]}
					>
						<LabelList
							className="tabular-nums"
							dataKey="revenueInCents"
							fontSize={12}
							formatter={(value) => formatPrice(Number(value ?? 0))}
							offset={8}
							position="right"
						/>
					</Bar>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
