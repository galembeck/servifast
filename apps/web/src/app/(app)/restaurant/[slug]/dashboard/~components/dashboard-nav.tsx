"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { PERIOD_LABELS } from "./format";
import { parseSalesPeriod, SALES_PERIODS } from "./period";

const SEGMENT_ITEM =
	"rounded-md px-4 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground";
const SEGMENT_ITEM_ACTIVE = "bg-background text-foreground shadow-sm";

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

			<nav
				aria-label="Período"
				className="inline-flex rounded-lg border bg-muted/40 p-1"
			>
				{SALES_PERIODS.map((option) => (
					<Link
						aria-current={option === period ? "page" : undefined}
						className={cn(
							SEGMENT_ITEM,
							option === period && SEGMENT_ITEM_ACTIVE
						)}
						href={`${pathname}?period=${option}`}
						key={option}
						scroll={false}
					>
						{PERIOD_LABELS[option]}
					</Link>
				))}
			</nav>
		</div>
	);
}
