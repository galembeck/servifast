import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { CashRegisterTransaction } from "@/api/http/services/get-cash-register-transactions";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CashTransactionsTable } from "./cash-transactions-table";
import { formatDateTime, formatPrice } from "./format";

interface ClosedSession {
	closedAt: string;
	countedAmountInCents: number;
	differenceInCents: number;
	expectedAmountInCents: number;
	openedAt: string;
	openingAmountInCents: number;
}

interface ClosingSummaryProps {
	/** Where "Concluir" goes: the cash register screen without the summary. */
	doneHref: string;
	session: ClosedSession;
	transactions: CashRegisterTransaction[];
}

function sumByType(
	transactions: CashRegisterTransaction[],
	type: CashRegisterTransaction["type"]
) {
	return transactions
		.filter((transaction) => transaction.type === type)
		.reduce((total, transaction) => total + transaction.amountInCents, 0);
}

function differenceLabel(differenceInCents: number) {
	if (differenceInCents === 0) {
		return "Sem diferença";
	}

	return differenceInCents > 0
		? `Sobra de ${formatPrice(differenceInCents)}`
		: `Falta de ${formatPrice(-differenceInCents)}`;
}

export function ClosingSummary({
	doneHref,
	session,
	transactions,
}: ClosingSummaryProps) {
	const suppliesInCents = sumByType(transactions, "SUPPLY");
	const withdrawalsInCents = sumByType(transactions, "WITHDRAWAL");
	// expected = float + supplies − withdrawals + cash sales
	const cashSalesInCents =
		session.expectedAmountInCents -
		session.openingAmountInCents -
		suppliesInCents +
		withdrawalsInCents;
	const closedBy = transactions.find(
		(transaction) => transaction.type === "CLOSING"
	)?.operator.name;

	const rows = [
		{
			label: "Fundo de troco",
			value: formatPrice(session.openingAmountInCents),
		},
		{ label: "Suprimentos", value: formatPrice(suppliesInCents) },
		{
			label: "Sangrias",
			value:
				withdrawalsInCents > 0
					? `− ${formatPrice(withdrawalsInCents)}`
					: formatPrice(0),
		},
		{ label: "Vendas em dinheiro", value: formatPrice(cashSalesInCents) },
	];

	return (
		<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<CheckCircle2 className="size-5 text-emerald-600" />
						Caixa fechado
					</CardTitle>
					<CardDescription>
						Aberto em {formatDateTime(session.openedAt)} · Fechado em{" "}
						{formatDateTime(session.closedAt)}
						{closedBy ? ` por ${closedBy}` : ""}
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-3 text-sm">
					{rows.map(({ label, value }) => (
						<div className="flex justify-between" key={label}>
							<span className="text-muted-foreground">{label}</span>
							<span>{value}</span>
						</div>
					))}

					<Separator />

					<div className="flex justify-between font-medium">
						<span>Esperado em caixa</span>
						<span>{formatPrice(session.expectedAmountInCents)}</span>
					</div>
					<div className="flex justify-between font-medium">
						<span>Contado</span>
						<span>{formatPrice(session.countedAmountInCents)}</span>
					</div>

					<div
						className={cn(
							"flex justify-between rounded-md px-4 py-3 font-semibold text-base",
							session.differenceInCents === 0 && "bg-muted",
							session.differenceInCents > 0 &&
								"bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
							session.differenceInCents < 0 &&
								"bg-destructive/10 text-destructive"
						)}
					>
						<span>Diferença</span>
						<span>{differenceLabel(session.differenceInCents)}</span>
					</div>

					<Button asChild className="mt-2 w-full">
						<Link href={doneHref}>Concluir</Link>
					</Button>
				</CardContent>
			</Card>

			<section className="min-w-0 space-y-3">
				<h2 className="font-medium text-lg leading-none">
					Movimentações do dia
				</h2>
				<CashTransactionsTable transactions={transactions} />
			</section>
		</div>
	);
}
