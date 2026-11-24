"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { type BillInvoice, getBillSplit } from "@/api/http/services/bill-split";
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
import { Label } from "@/components/ui/label";
import { formatPrice } from "../../../dashboard/~components/format";
import { payInvoiceAction } from "../~actions/actions";

const methods: { method: PaymentMethod; label: string }[] = [
	{ method: "CASH", label: "Dinheiro" },
	{ method: "CREDIT_CARD", label: "Crédito" },
	{ method: "DEBIT_CARD", label: "Débito" },
	{ method: "PIX", label: "PIX" },
];
function PayInvoice({
	invoice,
	restaurant,
	tabId,
}: {
	invoice: BillInvoice;
	restaurant: string;
	tabId: string;
}) {
	const [open, setOpen] = useState(false);
	const [method, setMethod] = useState<PaymentMethod | null>(null);
	const [received, setReceived] = useState(0);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const sending = useRef(false);
	const query = useQueryClient();
	const router = useRouter();
	const isCash = method === "CASH";
	const change = received - invoice.amountInCents;
	async function pay() {
		if (sending.current || !method) {
			return;
		}
		sending.current = true;
		setBusy(true);
		setError(null);
		try {
			const result = await payInvoiceAction(tabId, invoice.id, {
				method,
				...(isCash ? { receivedInCents: received } : {}),
			});
			if (!result.success) {
				setError(result.title);
				return;
			}
			query.setQueryData(["bill-split", restaurant, tabId], {
				split: result.split,
			});
			await query.invalidateQueries({
				queryKey: ["restaurants", restaurant, "tabs", tabId],
			});
			await query.invalidateQueries({ queryKey: ["cash-flow", restaurant] });
			setOpen(false);
			router.refresh();
		} finally {
			sending.current = false;
			setBusy(false);
		}
	}
	return (
		<Dialog
			onOpenChange={(value) => {
				if (!sending.current) {
					setOpen(value);
				}
			}}
			open={open}
		>
			<DialogTrigger asChild>
				<Button type="button">Pagar parcela</Button>
			</DialogTrigger>
			<DialogContent showCloseButton={!busy}>
				<DialogHeader>
					<DialogTitle>Pagar {invoice.name}</DialogTitle>
					<DialogDescription>
						Valor da parcela: {formatPrice(invoice.amountInCents)}
					</DialogDescription>
				</DialogHeader>
				<fieldset className="space-y-3" disabled={busy}>
					<legend>Forma de pagamento</legend>
					<div className="flex flex-wrap gap-2">
						{methods.map((option) => (
							<Button
								aria-pressed={method === option.method}
								key={option.method}
								onClick={() => setMethod(option.method)}
								type="button"
								variant={method === option.method ? "default" : "outline"}
							>
								{option.label}
							</Button>
						))}
					</div>
					{isCash && (
						<>
							<Label htmlFor={invoice.id}>Valor recebido (R$)</Label>
							<CurrencyInput
								id={invoice.id}
								name="invoice-cash"
								onValueChange={setReceived}
								valueInCents={received}
							/>
							<Button
								onClick={() => setReceived(invoice.amountInCents)}
								type="button"
								variant="outline"
							>
								Valor exato
							</Button>
							<p aria-live="polite">
								{change < 0
									? `Faltam ${formatPrice(-change)}`
									: `Troco: ${formatPrice(change)}`}
							</p>
						</>
					)}
					{error && (
						<p className="text-destructive" role="alert">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button
							onClick={() => setOpen(false)}
							type="button"
							variant="outline"
						>
							Cancelar
						</Button>
						<Button
							disabled={!method || (isCash && change < 0)}
							onClick={pay}
							type="button"
						>
							{busy ? "Registrando..." : "Confirmar pagamento"}
						</Button>
					</DialogFooter>
				</fieldset>
			</DialogContent>
		</Dialog>
	);
}
export function SplitBillPanel({
	restaurant,
	tabId,
	items = [],
}: {
	items?: TabItem[];
	restaurant: string;
	tabId: string;
}) {
	const query = useQuery({
		queryKey: ["bill-split", restaurant, tabId],
		queryFn: () => getBillSplit(restaurant, tabId),
		refetchInterval: (query) =>
			query.state.data?.split?.closedAt ? false : 5000,
		retry: false,
	});
	if (query.isPending) {
		return <p role="status">Carregando parcelas...</p>;
	}
	if (query.isError) {
		return (
			<div role="alert">
				Não foi possível carregar as parcelas.{" "}
				<Button onClick={() => query.refetch()}>Tentar novamente</Button>
			</div>
		);
	}
	const split = query.data?.split;
	if (!split) {
		return null;
	}
	return (
		<section
			aria-label="Parcelas da conta"
			className="space-y-3 rounded-lg border p-4"
		>
			<h2 className="font-semibold text-lg">Conta dividida</h2>
			<p>
				Subtotal: {formatPrice(split.subtotalInCents)} · Taxa:{" "}
				{formatPrice(split.serviceFeeInCents)} · Desconto:{" "}
				{formatPrice(split.discountInCents)}
			</p>
			<p>
				Total: {formatPrice(split.amountInCents)} · Pago:{" "}
				{formatPrice(split.paidInCents)} · Saldo restante:{" "}
				{formatPrice(split.remainingInCents)}
			</p>
			<p className="text-muted-foreground text-sm">
				Itens e ajustes bloqueados. A baixa de estoque acontece no primeiro
				pagamento, uma única vez.
			</p>
			{split.invoices.map((invoice) => (
				<fieldset
					aria-label={invoice.name}
					className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
					key={invoice.id}
				>
					<span>
						{invoice.name} — {formatPrice(invoice.amountInCents)}
					</span>
					{invoice.items.length > 0 && (
						<span className="text-muted-foreground text-xs">
							{invoice.items
								.map(
									(part) =>
										`${part.quantity} × ${items.find((item) => item.id === part.itemId)?.menuItem.name ?? "Item"}`
								)
								.join(", ")}
						</span>
					)}
					{invoice.payment ? (
						<span>
							Pago ·{" "}
							{methods.find((m) => m.method === invoice.payment?.method)?.label}
						</span>
					) : (
						<>
							<span>Pendente</span>
							<PayInvoice
								invoice={invoice}
								restaurant={restaurant}
								tabId={tabId}
							/>
						</>
					)}
				</fieldset>
			))}
			{split.closedAt && <p>Conta liquidada. Mesa liberada.</p>}
		</section>
	);
}
