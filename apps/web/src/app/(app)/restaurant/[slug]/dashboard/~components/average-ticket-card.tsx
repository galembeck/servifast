import { Receipt } from "lucide-react";
import type { AverageTicketReport } from "@/api/http/services/get-average-ticket";
import type { SalesPeriod } from "@/api/http/services/get-sales-report";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { COMPARISON_LABELS, formatInteger, formatPrice } from "./format";
import { Delta } from "./kpi-card";

interface AverageTicketCardProps {
	period: SalesPeriod;
	report: AverageTicketReport;
}

export function AverageTicketCard({ period, report }: AverageTicketCardProps) {
	const { current, previous } = report;
	const services = current.completedServices;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Receipt aria-hidden className="size-4 text-muted-foreground" />
					Ticket médio
				</CardTitle>
				<CardDescription>
					Valor médio gasto por atendimento concluído.
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				<p className="font-semibold text-4xl tabular-nums tracking-tight">
					{formatPrice(current.averageTicketInCents)}
				</p>

				{/* RN01 spelled out, so the number can be checked at a glance. */}
				<dl className="space-y-1.5 rounded-md bg-muted/50 px-3 py-2.5 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">Faturamento consolidado</dt>
						<dd className="tabular-nums">
							{formatPrice(current.revenueInCents)}
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">÷ Atendimentos concluídos</dt>
						<dd className="tabular-nums">{formatInteger(services)}</dd>
					</div>
				</dl>

				{services === 0 && (
					<p className="text-muted-foreground text-xs">
						Nenhum atendimento concluído no período: o ticket médio aparece
						quando a primeira comanda for fechada.
					</p>
				)}

				<p className="text-xs">
					<Delta
						current={current.averageTicketInCents}
						previous={previous.averageTicketInCents}
					/>{" "}
					<span className="text-muted-foreground">
						vs. {COMPARISON_LABELS[period]} (
						{formatPrice(previous.averageTicketInCents)} em{" "}
						{formatInteger(previous.completedServices)}{" "}
						{previous.completedServices === 1 ? "atendimento" : "atendimentos"})
					</span>
				</p>
			</CardContent>
		</Card>
	);
}
