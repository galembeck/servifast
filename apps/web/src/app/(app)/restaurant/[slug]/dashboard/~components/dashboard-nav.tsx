"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ReportPeriodSelector } from "@/components/report-period-selector";
import { cn } from "@/lib/utils";
import { parseSalesPeriod } from "./period";

/**
 * Sub-tabs (overview / products) and the period selector. Each keeps the
 * other's state: switching tabs keeps ?period=, switching period keeps the tab.
 */
export function DashboardNav({ slug }: { slug: string }) {
	const pathname = usePathname();
	const period = parseSalesPeriod(useSearchParams().get("period"));

	const base = `/restaurant/${slug}/dashboard`;
	const views = [
		{ href: base, label: "Visão geral" },
		{ href: `${base}/products`, label: "Produtos e ticket" },
	];

	return (
		<div className="flex flex-wrap items-center justify-between gap-4">
			<nav aria-label="Seções do dashboard" className="flex gap-1 border-b">
				{views.map(({ href, label }) => {
					const isActive = pathname === href;

					return (
						<Link
							aria-current={isActive ? "page" : undefined}
							className={cn(
								"-mb-px border-transparent border-b-2 px-3 pb-2 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground",
								isActive && "border-chart-sales text-foreground"
							)}
							href={`${href}?period=${period}`}
							key={href}
						>
							{label}
						</Link>
					);
				})}
			</nav>

			<ReportPeriodSelector period={period} />
		</div>
	);
}
