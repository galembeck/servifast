import { CircleAlert, TriangleAlert } from "lucide-react";
import type { StockAlertLevel } from "@/lib/stock";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

const LEVELS: Record<
	StockAlertLevel,
	{ className: string; icon: typeof CircleAlert; label: string }
> = {
	CRITICAL: {
		label: "Crítico",
		icon: CircleAlert,
		className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
	},
	LOW: {
		label: "Estoque baixo",
		icon: TriangleAlert,
		className:
			"bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-300",
	},
};

/** Red = sold out, yellow = at or below the minimum. Icon + label, never color alone. */
export function StockAlertBadge({
	level,
	className,
}: {
	className?: string;
	level: StockAlertLevel;
}) {
	const { label, icon: Icon, className: levelClassName } = LEVELS[level];

	return (
		<Badge className={cn(levelClassName, className)} variant="secondary">
			<Icon aria-hidden />
			{label}
		</Badge>
	);
}
