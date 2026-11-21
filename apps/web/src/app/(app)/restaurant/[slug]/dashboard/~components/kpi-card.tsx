import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPercentChange } from "./format";

interface KpiCardProps {
	comparisonLabel: string;
	current: number;
	format: (value: number) => string;
	label: string;
	previous: number;
}

function Delta({ current, previous }: { current: number; previous: number }) {
	if (previous === 0) {
		return (
			<span className="inline-flex items-center gap-1 text-muted-foreground">
				<Minus aria-hidden className="size-3.5" />
				{current === 0 ? "sem variação" : "sem base de comparação"}
			</span>
		);
	}

	const ratio = (current - previous) / previous;
	const isUp = ratio > 0;
	const isDown = ratio < 0;

	let Icon = Minus;
	if (isUp) {
		Icon = ArrowUpRight;
	} else if (isDown) {
		Icon = ArrowDownRight;
	}

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 font-medium",
				isUp && "text-emerald-700 dark:text-emerald-400",
				isDown && "text-destructive",
				!(isUp || isDown) && "text-muted-foreground"
			)}
		>
			<Icon aria-hidden className="size-3.5" />
			{formatPercentChange(ratio)}
		</span>
	);
}

export function KpiCard({
	comparisonLabel,
	current,
	format,
	label,
	previous,
}: KpiCardProps) {
	return (
		<Card className="gap-2">
			<CardHeader>
				<CardTitle className="font-normal text-muted-foreground text-sm">
					{label}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1">
				<p className="font-semibold text-2xl tabular-nums">{format(current)}</p>
				<p className="text-xs">
					<Delta current={current} previous={previous} />{" "}
					<span className="text-muted-foreground">
						vs. {comparisonLabel} ({format(previous)})
					</span>
				</p>
			</CardContent>
		</Card>
	);
}
