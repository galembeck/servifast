"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SalesPeriod } from "@/api/http/services/get-sales-report";
import { PERIOD_LABELS } from "@/app/(app)/restaurant/[slug]/dashboard/~components/format";
import { SALES_PERIODS } from "@/app/(app)/restaurant/[slug]/dashboard/~components/period";
import { cn } from "@/lib/utils";

const SEGMENT_ITEM =
	"rounded-md px-4 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground";
const SEGMENT_ITEM_ACTIVE = "bg-background text-foreground shadow-sm";
export function ReportPeriodSelector({ period }: { period: SalesPeriod }) {
	const pathname = usePathname();
	return (
		<nav
			aria-label="Período"
			className="inline-flex rounded-lg border bg-muted/40 p-1"
		>
			{SALES_PERIODS.map((option) => (
				<Link
					aria-current={option === period ? "page" : undefined}
					className={cn(SEGMENT_ITEM, option === period && SEGMENT_ITEM_ACTIVE)}
					href={`${pathname}?period=${option}`}
					key={option}
					scroll={false}
				>
					{PERIOD_LABELS[option]}
				</Link>
			))}
		</nav>
	);
}
