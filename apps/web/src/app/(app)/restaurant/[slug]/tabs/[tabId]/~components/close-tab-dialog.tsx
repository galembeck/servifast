"use client";

import {
	AlertTriangle,
	Banknote,
	CreditCard,
	Loader2,
	QrCode,
	Receipt,
	Wallet,
} from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import type { PaymentMethod } from "@/api/http/services/close-tab";
import type { TabItem } from "@/api/http/services/get-tab";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { closeTabAction } from "../~actions/actions";

const PAYMENT_METHODS: {
	icon: typeof Banknote;
	label: string;
	value: PaymentMethod;
}[] = [
	{ value: "CASH", label: "Dinheiro", icon: Banknote },
	{ value: "CREDIT_CARD", label: "Crédito", icon: CreditCard },
	{ value: "DEBIT_CARD", label: "Débito", icon: Wallet },
	{ value: "PIX", label: "PIX", icon: QrCode },
];

function pendingStatusLabel(item: TabItem) {
	if (item.status === "RECEIVED") {
		return item.sentToKitchenAt === null
			? "não enviado à cozinha"
			: "aguardando a cozinha";
	}
	return item.status === "PREPARING" ? "em preparo" : "pronto, não entregue";
}

/** Bill denominations (in cents) used to suggest common cash amounts. */
const BILL_STEPS_IN_CENTS = [1000, 2000, 5000, 10_000, 20_000];
const MAX_CASH_SUGGESTIONS = 3;
const CENTS_PER_REAL = 100;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

function formatPrice(priceInCents: number) {
	return currencyFormatter.format(priceInCents / CENTS_PER_REAL);
}

const NON_AMOUNT_CHARS = /[^\d,.]/g;
const THOUSANDS_DOT = /\.(?=\d{3}(?:\D|$))/g;

/** Parses "100", "100,50" or "1.250,00" into cents; null if not a number. */
function parseAmountToCents(value: string): number | null {
	const normalized = value
		.replace(NON_AMOUNT_CHARS, "")
		.replace(THOUSANDS_DOT, "")
		.replace(",", ".");

	if (normalized === "") {
		return null;
	}

	const amount = Number(normalized);
	return Number.isFinite(amount) ? Math.round(amount * CENTS_PER_REAL) : null;
}

/** The next round amounts a customer is likely to hand over, above the total. */
function suggestCashAmounts(totalInCents: number) {
	const suggestions = new Set<number>();

	for (const step of BILL_STEPS_IN_CENTS) {
		const rounded = Math.ceil(totalInCents / step) * step;
		if (rounded > totalInCents) {
			suggestions.add(rounded);
		}
	}

	return [...suggestions].sort((a, b) => a - b).slice(0, MAX_CASH_SUGGESTIONS);
}

interface CloseTabDialogProps {
	items: TabItem[];
	tabId: string;
}

export function CloseTabDialog({ items, tabId }: CloseTabDialogProps) {
	const receivedInputId = useId();
	const [open, setOpen] = useState(false);
	const [method, setMethod] = useState<PaymentMethod | null>(null);
	const [receivedInput, setReceivedInput] = useState("");
	const [isPending, startTransition] = useTransition();

	const billableItems = items.filter((item) => item.status !== "CANCELLED");
	const totalInCents = billableItems.reduce(
		(total, item) => total + item.quantity * item.unitPriceInCents,
		0
	);
	const pendingItems = billableItems.filter(
		(item) => item.status !== "DELIVERED"
	);

	const isCash = method === "CASH";
	const receivedInCents = parseAmountToCents(receivedInput);
	const changeInCents =
		receivedInCents === null ? null : receivedInCents - totalInCents;
	const isCashInsufficient = isCash && (changeInCents ?? -1) < 0;
	const hasPendingItems = pendingItems.length > 0;
	const canConfirm =
		method !== null && !hasPendingItems && !isCashInsufficient && !isPending;

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) {
			setMethod(null);
			setReceivedInput("");
		}
	}

	function setReceivedAmount(amountInCents: number) {
		setReceivedInput(
			(amountInCents / CENTS_PER_REAL).toFixed(2).replace(".", ",")
		);
	}

	function handleConfirm() {
		if (!method) {
			return;
		}

		startTransition(async () => {
			const result = await closeTabAction(
				tabId,
				method,
				isCash ? (receivedInCents ?? undefined) : undefined
			);

			if (!result.success) {
				toast.error(result.title);
				return;
			}

			const { changeInCents: change } = result.payment;
			toast.success(result.title, {
				description:
					change === null
						? "A mesa foi liberada."
						: `Troco: ${formatPrice(change)}. A mesa foi liberada.`,
			});
			// The tab screen switches to its closed state, which offers the
			// receipt and the way back to the tables.
			setOpen(false);
		});
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogTrigger asChild>
				<Button type="button" variant="secondary">
					<Receipt className="mr-2 size-4" />
					Fechar conta
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Fechar conta</DialogTitle>
					<DialogDescription>
						Escolha a forma de pagamento. Ao confirmar, a comanda é encerrada e
						a mesa fica livre.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5">
					<div className="flex items-baseline justify-between rounded-md border px-4 py-3">
						<span className="text-muted-foreground text-sm">
							Total ({billableItems.length}{" "}
							{billableItems.length === 1 ? "item" : "itens"})
						</span>
						<span className="font-semibold text-2xl">
							{formatPrice(totalInCents)}
						</span>
					</div>

					{hasPendingItems && (
						<div
							className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
							role="alert"
						>
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
							<div className="space-y-1">
								<p className="font-medium">
									Não é possível fechar a conta: {pendingItems.length}{" "}
									{pendingItems.length === 1
										? "item ainda não foi entregue"
										: "itens ainda não foram entregues"}
									.
								</p>
								<p className="text-muted-foreground text-xs">
									Entregue ou cancele os itens abaixo antes de liberar a mesa.
								</p>
								<ul className="list-disc pl-4 text-muted-foreground text-xs">
									{pendingItems.map((item) => (
										<li key={item.id}>
											{item.quantity}× {item.menuItem.name} —{" "}
											{pendingStatusLabel(item)}
										</li>
									))}
								</ul>
							</div>
						</div>
					)}

					<fieldset className="space-y-2" disabled={hasPendingItems}>
						<legend className="font-medium text-sm">Forma de pagamento</legend>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							{PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
								<Button
									aria-pressed={method === value}
									className="h-auto flex-col gap-1 py-3"
									key={value}
									onClick={() => setMethod(value)}
									type="button"
									variant={method === value ? "default" : "outline"}
								>
									<Icon className="size-5" />
									{label}
								</Button>
							))}
						</div>
					</fieldset>

					{isCash && !hasPendingItems && (
						<div className="space-y-3">
							<div className="space-y-2">
								<Label htmlFor={receivedInputId}>Valor recebido (R$)</Label>
								<Input
									autoFocus
									id={receivedInputId}
									inputMode="decimal"
									onChange={(event) => setReceivedInput(event.target.value)}
									placeholder="0,00"
									value={receivedInput}
								/>
							</div>

							<div className="flex flex-wrap gap-2">
								<Button
									onClick={() => setReceivedAmount(totalInCents)}
									size="sm"
									type="button"
									variant="outline"
								>
									Valor exato
								</Button>
								{suggestCashAmounts(totalInCents).map((amount) => (
									<Button
										key={amount}
										onClick={() => setReceivedAmount(amount)}
										size="sm"
										type="button"
										variant="outline"
									>
										{formatPrice(amount)}
									</Button>
								))}
							</div>

							<div
								aria-live="polite"
								className="flex items-baseline justify-between rounded-md bg-muted px-4 py-3"
							>
								<span className="text-muted-foreground text-sm">Troco</span>
								{changeInCents !== null && changeInCents < 0 ? (
									<span className="font-medium text-destructive text-sm">
										Faltam {formatPrice(-changeInCents)}
									</span>
								) : (
									<span className="font-semibold text-xl">
										{formatPrice(changeInCents ?? 0)}
									</span>
								)}
							</div>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						onClick={() => handleOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancelar
					</Button>
					<Button disabled={!canConfirm} onClick={handleConfirm} type="button">
						{isPending ? (
							<>
								<Loader2 className="mr-2 size-4 animate-spin" />
								Fechando...
							</>
						) : (
							`Confirmar ${formatPrice(totalInCents)}`
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
