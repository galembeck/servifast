"use client";

import { AlertTriangle, EyeOff, Loader2, Lock } from "lucide-react";
import { type SubmitEvent, useState, useTransition } from "react";
import type { CashRegisterClosing } from "@/api/http/services/close-cash-register";
import { CurrencyInput } from "@/components/currency-input";
import { Alert, AlertTitle } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
	closeCashRegisterAction,
	finishCashRegisterClosingAction,
} from "../~actions/actions";
import { formatPrice } from "./format";

function differenceLabel(differenceInCents: number) {
	if (differenceInCents === 0) {
		return "Sem diferença";
	}

	return differenceInCents > 0
		? `Sobra de ${formatPrice(differenceInCents)}`
		: `Falta de ${formatPrice(-differenceInCents)}`;
}

function ClosingSummary({ closing }: { closing: CashRegisterClosing }) {
	const rows = [
		{ label: "Fundo de troco", value: closing.openingAmountInCents },
		{ label: "Suprimentos", value: closing.suppliesInCents },
		{ label: "Sangrias", value: -closing.withdrawalsInCents },
		{ label: "Vendas em dinheiro", value: closing.cashSalesInCents },
	];

	return (
		<div className="space-y-3 text-sm">
			{rows.map(({ label, value }) => (
				<div className="flex justify-between" key={label}>
					<span className="text-muted-foreground">{label}</span>
					<span>{formatPrice(value)}</span>
				</div>
			))}

			<Separator />

			<div className="flex justify-between font-medium">
				<span>Esperado em caixa</span>
				<span>{formatPrice(closing.expectedAmountInCents)}</span>
			</div>
			<div className="flex justify-between font-medium">
				<span>Contado</span>
				<span>{formatPrice(closing.countedAmountInCents)}</span>
			</div>

			<div
				className={cn(
					"flex justify-between rounded-md px-4 py-3 font-semibold text-base",
					closing.differenceInCents === 0 && "bg-muted",
					closing.differenceInCents > 0 &&
						"bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
					closing.differenceInCents < 0 && "bg-destructive/10 text-destructive"
				)}
			>
				<span>Diferença</span>
				<span>{differenceLabel(closing.differenceInCents)}</span>
			</div>
		</div>
	);
}

export function CloseCashRegisterDialog() {
	const [open, setOpen] = useState(false);
	const [closing, setClosing] = useState<CashRegisterClosing | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [fieldError, setFieldError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [isFinishing, startFinishing] = useTransition();

	function finish() {
		startFinishing(async () => {
			// Only now refresh the page: it switches to the "closed" state, which
			// would unmount this dialog before the reconciliation was seen.
			await finishCashRegisterClosingAction();
			setOpen(false);
			setClosing(null);
		});
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && closing) {
			finish();
			return;
		}

		setOpen(nextOpen);
		setError(null);
		setFieldError(null);
	}

	function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);

		startTransition(async () => {
			const result = await closeCashRegisterAction(data);

			if (result.success) {
				setClosing(result.closing);
				return;
			}

			setError(result.title);
			setFieldError(result.errors?.countedAmount?.[0] ?? null);
		});
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogTrigger asChild>
				<Button className="h-auto flex-col gap-1 py-4" type="button">
					<Lock className="size-5" />
					Fechar caixa
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-md">
				{closing ? (
					<>
						<DialogHeader>
							<DialogTitle>Caixa fechado</DialogTitle>
							<DialogDescription>
								Conferência do valor contado com o esperado pelo sistema.
							</DialogDescription>
						</DialogHeader>

						<ClosingSummary closing={closing} />

						<DialogFooter>
							<Button disabled={isFinishing} onClick={finish} type="button">
								{isFinishing && (
									<Loader2 className="mr-2 size-4 animate-spin" />
								)}
								Concluir
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Fechar caixa</DialogTitle>
							<DialogDescription>
								Conte o dinheiro da gaveta e informe o total abaixo.
							</DialogDescription>
						</DialogHeader>

						<form
							className="space-y-4"
							id="close-cash-register"
							onSubmit={handleSubmit}
						>
							<div className="flex gap-2 rounded-md bg-muted px-3 py-2 text-muted-foreground text-xs">
								<EyeOff className="mt-0.5 size-4 shrink-0" />
								<p>
									Conferência cega: o valor esperado pelo sistema só aparece
									depois que você confirmar a contagem. Após o fechamento, o
									registro não pode ser alterado.
								</p>
							</div>

							{error && (
								<Alert variant="destructive">
									<AlertTriangle className="size-4" />
									<AlertTitle>{error}</AlertTitle>
								</Alert>
							)}

							<div className="space-y-3">
								<Label htmlFor="countedAmount">Valor contado (R$)</Label>

								<CurrencyInput
									autoFocus
									id="countedAmount"
									name="countedAmount"
								/>

								{fieldError && (
									<p className="font-medium text-destructive text-xs">
										{fieldError}
									</p>
								)}
							</div>
						</form>

						<DialogFooter>
							<Button
								onClick={() => handleOpenChange(false)}
								type="button"
								variant="outline"
							>
								Cancelar
							</Button>
							<Button
								disabled={isPending}
								form="close-cash-register"
								type="submit"
							>
								{isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
								Confirmar fechamento
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
