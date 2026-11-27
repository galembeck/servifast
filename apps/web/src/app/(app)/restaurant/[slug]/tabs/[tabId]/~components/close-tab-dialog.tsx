"use client";

import {
	type CheckoutAdjustment,
	type CheckoutAdjustments,
	calculateCheckoutTotals,
	checkoutTotalError,
} from "@repo/checkout";
import {
	AlertTriangle,
	Banknote,
	CreditCard,
	Loader2,
	QrCode,
	Receipt,
	Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { BillSplit } from "@/api/http/services/bill-split";
import type { PaymentMethod } from "@/api/http/services/close-tab";
import type { TabItem } from "@/api/http/services/get-tab";
import { CurrencyInput } from "@/components/currency-input";
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
import { closeTabAction, partialPaymentAction } from "../~actions/actions";
import { CheckoutAdjustmentInput } from "./checkout-adjustment-input";
import { SplitBillBuilder } from "./split-bill-builder";

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

function getCheckoutPreview(
	subtotal: number,
	adjustments: CheckoutAdjustments
) {
	try {
		const totals = calculateCheckoutTotals(subtotal, adjustments);
		return {
			totals,
			adjustmentError: checkoutTotalError(totals.amountInCents),
		};
	} catch (error) {
		return {
			totals: null,
			adjustmentError:
				error instanceof RangeError ? error.message : "Confira os ajustes.",
		};
	}
}
interface CloseTabDialogProps {
	checkout?: BillSplit;
	items: TabItem[];
	onPayment?: (checkout: BillSplit) => void;
	restaurant: string;
	tabId: string;
}

export function CloseTabDialog({
	items,
	tabId,
	restaurant,
	checkout: initialCheckout,
	onPayment,
}: CloseTabDialogProps) {
	const [paidCheckout, setPaidCheckout] = useState<BillSplit>();
	const checkout = initialCheckout ?? paidCheckout;
	const router = useRouter();
	const partialId = useId();
	const [partial, setPartial] = useState(false);
	const [partialAmount, setPartialAmount] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const attempt = useRef<{ key: string; id: string } | null>(null);
	const receivedInputId = useId();
	const feeInputId = useId();
	const submitting = useRef(false);
	const [feeEnabled, setFeeEnabled] = useState(false);
	const [serviceFee, setServiceFee] = useState<CheckoutAdjustment>({
		type: "PERCENT",
		basisPoints: 0,
	});
	const [discount, setDiscount] = useState<CheckoutAdjustment>({
		type: "FIXED",
		amountInCents: 0,
	});
	const [open, setOpen] = useState(false);
	const [method, setMethod] = useState<PaymentMethod | null>(null);
	const [receivedInput, setReceivedInput] = useState("");
	const [isPending, startTransition] = useTransition();

	const billableItems = items.filter((item) => item.status !== "CANCELLED");
	const subtotalInCents = billableItems.reduce(
		(total, item) => total + item.quantity * item.unitPriceInCents,
		0
	);
	const adjustments = { ...(feeEnabled ? { serviceFee } : {}), discount };
	const { totals, adjustmentError, balance, totalInCents, partialError } =
		paymentPreview(
			subtotalInCents,
			adjustments,
			checkout,
			partial,
			partialAmount
		);
	const pendingItems = billableItems.filter(
		(item) => item.status !== "DELIVERED"
	);

	const { isCash, receivedInCents, changeInCents, isCashInsufficient } =
		cashPreview(method, receivedInput, totalInCents);
	const hasPendingItems = pendingItems.length > 0;
	const canConfirm =
		method !== null &&
		!hasPendingItems &&
		!isCashInsufficient &&
		!isPending &&
		!adjustmentError &&
		!partialError;

	function handleOpenChange(nextOpen: boolean) {
		if (submitting.current) {
			return;
		}
		setOpen(nextOpen);
		if (!nextOpen) {
			setPartial(false);
			setPartialAmount(0);
			setError(null);
			setMethod(null);
			setReceivedInput("");
			setFeeEnabled(false);
			setServiceFee({ type: "PERCENT", basisPoints: 0 });
			setDiscount({ type: "FIXED", amountInCents: 0 });
		}
	}

	function setReceivedAmount(amountInCents: number) {
		setReceivedInput(
			(amountInCents / CENTS_PER_REAL).toFixed(2).replace(".", ",")
		);
	}

	function handleConfirm() {
		if (!(method && canConfirm) || submitting.current) {
			return;
		}

		submitting.current = true;
		startTransition(async () => {
			try {
				const input = paymentInput(
					method,
					receivedInCents,
					checkout,
					adjustments
				);
				const key = JSON.stringify({ partial, totalInCents, ...input });
				if (attempt.current?.key !== key) {
					attempt.current = { key, id: crypto.randomUUID() };
				}
				setError(null);
				const result = await submitPayment(
					tabId,
					input,
					attempt.current.id,
					partial ? partialAmount : undefined
				);
				if (!result.success) {
					setError(result.title);
					toast.error(result.title);
					return;
				}

				if (result.partial) {
					setPaidCheckout(result.split);
					onPayment?.(result.split);
					toast.success("Pagamento parcial registrado", {
						description: `Saldo restante: ${formatPrice(result.split.remainingInCents)}`,
					});
				} else {
					showSettlementSuccess(result.title, result.payment.changeInCents);
				}
				// Refresh the persisted balance or the final receipt after success.
				setOpen(false);
				attempt.current = null;
				setPartial(false);
				setPartialAmount(0);
				setMethod(null);
				setReceivedInput("");
				router.refresh();
			} finally {
				submitting.current = false;
			}
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

			<DialogContent
				className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
				showCloseButton={!isPending}
			>
				<DialogHeader>
					<DialogTitle>Fechar conta</DialogTitle>
					<DialogDescription>
						Escolha a forma de pagamento. Você pode pagar parte do saldo ou
						quitar o restante para encerrar a comanda e liberar a mesa.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5">
					<fieldset
						className="space-y-3"
						disabled={isPending || hasPendingItems || Boolean(checkout)}
					>
						<div className="flex items-center gap-2">
							<input
								checked={feeEnabled}
								id={feeInputId}
								onChange={(event) => setFeeEnabled(event.target.checked)}
								type="checkbox"
							/>
							<Label htmlFor={feeInputId}>Incluir taxa de serviço</Label>
						</div>
						{feeEnabled && (
							<CheckoutAdjustmentInput
								label="Taxa de serviço"
								onChange={setServiceFee}
								value={serviceFee}
							/>
						)}
						<CheckoutAdjustmentInput
							label="Desconto"
							onChange={setDiscount}
							value={discount}
						/>
						<p className="text-muted-foreground text-xs">
							Percentuais calculados sobre o subtotal.
						</p>
					</fieldset>
					<PaymentSummary
						balance={balance}
						checkout={checkout}
						subtotal={subtotalInCents}
						totals={totals}
					/>
					<PartialFields
						balance={balance}
						disabled={isPending || hasPendingItems}
						onChange={setPartialAmount}
						partial={partial}
						partialAmount={partialAmount}
						partialError={partialError}
						partialId={partialId}
						toggle={() => {
							setPartial(!partial);
							setError(null);
						}}
					/>
					{error && (
						<p className="text-destructive text-sm" role="alert">
							{error}
						</p>
					)}
					{adjustmentError && (
						<p className="text-destructive text-sm" role="alert">
							{adjustmentError}
						</p>
					)}

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

					<fieldset
						className="space-y-2"
						disabled={hasPendingItems || isPending}
					>
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
									disabled={isPending}
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
					{!checkout && (
						<SplitBillBuilder
							adjustments={adjustments}
							disabled={
								hasPendingItems || Boolean(adjustmentError) || isPending
							}
							items={items}
							onCreated={() => setOpen(false)}
							restaurant={restaurant}
							tabId={tabId}
						/>
					)}
					<Button
						disabled={isPending}
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
								Processando...
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

function PaymentSummary({
	subtotal,
	totals,
	checkout,
	balance,
}: {
	subtotal: number;
	totals: ReturnType<typeof calculateCheckoutTotals> | null;
	checkout?: BillSplit;
	balance: number;
}) {
	return (
		<dl
			aria-label="Resumo do pagamento"
			aria-live="polite"
			className="space-y-2 rounded-md border px-4 py-3"
		>
			{[
				["Subtotal", checkout?.subtotalInCents ?? subtotal],
				["Taxa de serviço", totals?.serviceFeeInCents],
				["Desconto", totals ? 0 - totals.discountInCents : undefined],
				["Total", totals?.amountInCents],
				["Total pago", checkout?.paidInCents ?? 0],
				["Saldo restante", balance],
			].map(([label, value]) => (
				<div className="flex items-baseline justify-between gap-4" key={label}>
					<dt>{label}</dt>
					<dd
						className={
							label === "Total" ? "font-semibold text-2xl" : "tabular-nums"
						}
					>
						{typeof value === "number" ? formatPrice(value) : "—"}
					</dd>
				</div>
			))}
		</dl>
	);
}

function PartialFields({
	partial,
	partialAmount,
	partialId,
	partialError,
	balance,
	disabled,
	toggle,
	onChange,
}: {
	partial: boolean;
	partialAmount: number;
	partialId: string;
	partialError: boolean;
	balance: number;
	disabled: boolean;
	toggle: () => void;
	onChange: (cents: number) => void;
}) {
	return (
		<div className="space-y-2">
			<Button
				aria-pressed={partial}
				disabled={disabled}
				onClick={toggle}
				type="button"
				variant="outline"
			>
				Pagamento parcial
			</Button>
			{partial && (
				<>
					<Label htmlFor={partialId}>Valor parcial (R$)</Label>
					<CurrencyInput
						disabled={disabled}
						id={partialId}
						name="partialAmount"
						onValueChange={onChange}
						valueInCents={partialAmount}
					/>
					<p className="text-sm">
						Saldo após este pagamento:{" "}
						{formatPrice(Math.max(0, balance - partialAmount))}
					</p>
					{partialError && (
						<p className="text-destructive text-sm" role="alert">
							Informe um valor positivo menor que o saldo. Para quitar, desative
							Pagamento parcial.
						</p>
					)}
				</>
			)}
		</div>
	);
}

async function submitPayment(
	tabId: string,
	input: CheckoutAdjustments & {
		method: PaymentMethod;
		receivedInCents?: number;
	},
	requestId: string,
	partialAmount?: number
) {
	if (partialAmount !== undefined) {
		const result = await partialPaymentAction(tabId, {
			...input,
			requestId,
			amountInCents: partialAmount,
		});
		return { ...result, partial: true as const };
	}
	const result = await closeTabAction(
		tabId,
		input.method,
		input.receivedInCents,
		{ serviceFee: input.serviceFee, discount: input.discount },
		requestId
	);
	return { ...result, partial: false as const };
}
function showSettlementSuccess(title: string, change: number | null) {
	toast.success(title, {
		description:
			change === null
				? "A mesa foi liberada."
				: `Troco: ${formatPrice(change)}. A mesa foi liberada.`,
	});
}

function paymentPreview(
	subtotalInCents: number,
	adjustments: CheckoutAdjustments,
	checkout: BillSplit | undefined,
	partial: boolean,
	partialAmount: number
) {
	const preview = getCheckoutPreview(subtotalInCents, adjustments);
	const totals = checkout ?? preview.totals;
	const adjustmentError = checkout ? null : preview.adjustmentError;
	const balance = checkout?.remainingInCents ?? totals?.amountInCents ?? 0;
	const totalInCents = partial ? partialAmount : balance;
	const partialError =
		partial && (partialAmount <= 0 || partialAmount >= balance);
	return { totals, adjustmentError, balance, totalInCents, partialError };
}

function paymentInput(
	method: PaymentMethod,
	receivedInCents: number | null,
	checkout: BillSplit | undefined,
	adjustments: CheckoutAdjustments
) {
	return {
		method,
		receivedInCents:
			method === "CASH" ? (receivedInCents ?? undefined) : undefined,
		...(checkout ? {} : adjustments),
	};
}

function cashPreview(
	method: PaymentMethod | null,
	receivedInput: string,
	totalInCents: number
) {
	const isCash = method === "CASH";
	const receivedInCents = parseAmountToCents(receivedInput);
	const changeInCents =
		receivedInCents === null ? null : receivedInCents - totalInCents;
	const isCashInsufficient = isCash && (changeInCents ?? -1) < 0;
	return { isCash, receivedInCents, changeInCents, isCashInsufficient };
}
