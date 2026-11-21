"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getStockAlerts } from "@/api/http/services/get-stock-alerts";
import { cn } from "@/lib/utils";
import { StockAlertBadge } from "../stock-alert-badge";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

const REFRESH_INTERVAL_IN_MS = 30_000;
const MAX_ALERTS_IN_POPOVER = 6;

/** Notification center: low-stock alerts, refreshed every 30 s. */
export function StockAlertsBell({ slug }: { slug: string }) {
	const [isOpen, setIsOpen] = useState(false);

	const { data, isError } = useQuery({
		queryKey: ["stock-alerts", slug, "all"],
		queryFn: () => getStockAlerts(slug),
		refetchInterval: REFRESH_INTERVAL_IN_MS,
	});

	const summary = data?.summary ?? { total: 0, critical: 0, low: 0 };
	const alerts = data?.alerts.slice(0, MAX_ALERTS_IN_POPOVER) ?? [];
	const hiddenCount = summary.total - alerts.length;

	return (
		<Popover onOpenChange={setIsOpen} open={isOpen}>
			<PopoverTrigger asChild>
				<Button
					className="relative border border-border"
					size="icon"
					variant="ghost"
				>
					<Bell className="h-[1.2rem] w-[1.2rem]" />

					{summary.total > 0 && (
						<span
							aria-hidden
							className={cn(
								"absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-semibold text-[10px] tabular-nums",
								summary.critical > 0
									? "bg-destructive text-white"
									: "bg-amber-400 text-amber-950"
							)}
						>
							{summary.total > 99 ? "99+" : summary.total}
						</span>
					)}

					<span className="sr-only">
						Alertas de estoque: {summary.critical} crítico(s) e {summary.low}{" "}
						baixo(s)
					</span>
				</Button>
			</PopoverTrigger>

			<PopoverContent align="end" className="w-80 space-y-3">
				<div className="flex items-baseline justify-between gap-2">
					<span className="font-medium text-sm">Alertas de estoque</span>
					<span className="text-muted-foreground text-xs tabular-nums">
						{summary.critical} crítico(s) · {summary.low} baixo(s)
					</span>
				</div>

				{isError && (
					<p className="text-destructive text-xs">
						Não foi possível carregar os alertas.
					</p>
				)}

				{!isError && summary.total === 0 && (
					<p className="py-4 text-center text-muted-foreground text-sm">
						Nenhum produto abaixo do mínimo.
					</p>
				)}

				{alerts.length > 0 && (
					<ul className="space-y-1">
						{alerts.map((alert) => (
							<li
								className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
								key={alert.menuItemId}
							>
								<div className="min-w-0">
									<p className="truncate font-medium">{alert.name}</p>
									<p className="text-muted-foreground text-xs tabular-nums">
										Saldo {alert.stockQuantity} · mín. {alert.minStockQuantity}
									</p>
								</div>
								<StockAlertBadge level={alert.level} />
							</li>
						))}
					</ul>
				)}

				<Button asChild className="w-full" size="sm" variant="outline">
					<Link
						href={`/restaurant/${slug}/stock`}
						onClick={() => setIsOpen(false)}
					>
						{hiddenCount > 0
							? `Ver todos (+${hiddenCount})`
							: "Ver todos os alertas"}
					</Link>
				</Button>
			</PopoverContent>
		</Popover>
	);
}
