import type { CashRegisterTransaction } from "@/api/http/services/get-cash-register-transactions";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatPrice, formatTime, TRANSACTION_TYPE_LABELS } from "./format";

interface CashTransactionsTableProps {
	transactions: CashRegisterTransaction[];
}

export function CashTransactionsTable({
	transactions,
}: CashTransactionsTableProps) {
	if (transactions.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Nenhuma movimentação registrada.
			</p>
		);
	}

	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-20">Horário</TableHead>
						<TableHead>Tipo</TableHead>
						<TableHead>Motivo</TableHead>
						<TableHead>Operador</TableHead>
						<TableHead className="text-right">Valor</TableHead>
					</TableRow>
				</TableHeader>

				<TableBody>
					{transactions.map((transaction) => {
						const isWithdrawal = transaction.type === "WITHDRAWAL";

						return (
							<TableRow key={transaction.id}>
								<TableCell className="text-muted-foreground">
									{formatTime(transaction.createdAt)}
								</TableCell>
								<TableCell>
									<Badge variant={isWithdrawal ? "destructive" : "secondary"}>
										{TRANSACTION_TYPE_LABELS[transaction.type]}
									</Badge>
								</TableCell>
								<TableCell className="max-w-64 truncate text-muted-foreground">
									{transaction.description ?? "—"}
								</TableCell>
								<TableCell>{transaction.operator.name ?? "—"}</TableCell>
								<TableCell
									className={cn(
										"text-right font-medium",
										isWithdrawal && "text-destructive"
									)}
								>
									{isWithdrawal ? "− " : ""}
									{formatPrice(transaction.amountInCents)}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
