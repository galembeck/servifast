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
import { ClosingSummary } from "./~components/closing-summary";
import { formatDateTime, formatPrice } from "./~components/format";
import { OpenCashRegisterForm } from "./~components/open-cash-register-form";

/** Loads a closed session for the summary screen; null if it can't be shown. */
async function getClosedSession(slug: string, sessionId: string) {
	try {
		const { session, transactions } = await getCashRegisterTransactions(
			slug,
			sessionId
		);

		if (
			session?.closedAt == null ||
			session.countedAmountInCents === null ||
			session.expectedAmountInCents === null ||
			session.differenceInCents === null
		) {
			return null;
		}

		return {
			session: {
				...session,
				closedAt: session.closedAt,
				countedAmountInCents: session.countedAmountInCents,
				expectedAmountInCents: session.expectedAmountInCents,
				differenceInCents: session.differenceInCents,
			},
			transactions,
		};
	} catch {
		// Unknown or malformed id: fall back to the regular screen.
		return null;
	}
}

export default async function RestaurantCashRegisterPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ fechamento?: string }>;
}) {
	const { slug } = await params;
	const { fechamento } = await searchParams;
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

	const closed = fechamento ? await getClosedSession(slug, fechamento) : null;

	if (closed) {
		return (
			<div className="space-y-6">
				<div className="flex items-center gap-3">
					<h1 className="font-semibold text-2xl">Caixa</h1>
					<Badge variant="secondary">Fechamento</Badge>
				</div>

				<ClosingSummary
					doneHref={`/restaurant/${slug}/cash-register`}
					session={closed.session}
					transactions={closed.transactions}
				/>
			</div>
		);
	}

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
