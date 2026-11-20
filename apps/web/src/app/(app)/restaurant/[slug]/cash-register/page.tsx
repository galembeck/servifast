import { getCashRegister } from "@/api/http/services/get-cash-register";
import { getCashRegisterTransactions } from "@/api/http/services/get-cash-register-transactions";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ability } from "@/providers/auth-provider";
import { CashMovementDialog } from "./~components/cash-movement-dialog";
import { CashTransactionsTable } from "./~components/cash-transactions-table";
import { CloseCashRegisterDialog } from "./~components/close-cash-register-dialog";
import { formatDateTime, formatPrice } from "./~components/format";
import { OpenCashRegisterForm } from "./~components/open-cash-register-form";

export default async function RestaurantCashRegisterPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const permissions = await ability();

	if (!permissions?.can("get", "Shift")) {
		return (
			<div className="space-y-4">
				<h1 className="font-semibold text-2xl">Caixa</h1>
				<p className="text-muted-foreground text-sm">
					Você não tem permissão para acessar o caixa deste restaurante.
				</p>
			</div>
		);
	}

	const canOperate = permissions.can("manage", "Shift");

	const [{ session }, { transactions }] = await Promise.all([
		getCashRegister(slug),
		getCashRegisterTransactions(slug),
	]);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<h1 className="font-semibold text-2xl">Caixa</h1>
				<Badge variant={session ? "default" : "secondary"}>
					{session ? "Aberto" : "Fechado"}
				</Badge>
			</div>

			{!session &&
				(canOperate ? (
					<OpenCashRegisterForm />
				) : (
					<p className="text-muted-foreground text-sm">O caixa está fechado.</p>
				))}

			{session && (
				<>
					<Card>
						<CardHeader>
							<CardTitle>Caixa do dia</CardTitle>
							<CardDescription>
								Aberto em {formatDateTime(session.openedAt)} por{" "}
								{session.openedBy.name ?? "operador sem nome"} · Fundo de troco
								de {formatPrice(session.openingAmountInCents)}
							</CardDescription>
						</CardHeader>

						{canOperate && (
							<CardContent>
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
									<CashMovementDialog type="SUPPLY" />
									<CashMovementDialog type="WITHDRAWAL" />
									<CloseCashRegisterDialog />
								</div>
							</CardContent>
						)}
					</Card>

					<section className="space-y-3">
						<h2 className="font-medium text-lg">Movimentações</h2>
						<CashTransactionsTable transactions={transactions} />
					</section>
				</>
			)}
		</div>
	);
}
