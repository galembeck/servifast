"use client";

import { AlertTriangle, EyeOff, Loader2, Lock } from "lucide-react";
import { type SubmitEvent, useState, useTransition } from "react";
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
import { closeCashRegisterAction } from "../~actions/actions";

/**
 * Blind count only: on success the action redirects to the closing summary
 * page, so this dialog never shows the expected amount.
 */
export function CloseCashRegisterDialog() {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldError, setFieldError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		setError(null);
		setFieldError(null);
	}

	function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);

		startTransition(async () => {
			// Only returns on failure; success redirects to the summary.
			const result = await closeCashRegisterAction(data);

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
							Conferência cega: o valor esperado pelo sistema só aparece depois
							que você confirmar a contagem. Após o fechamento, o registro não
							pode ser alterado.
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

						<CurrencyInput autoFocus id="countedAmount" name="countedAmount" />

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
					<Button disabled={isPending} form="close-cash-register" type="submit">
						{isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
						Confirmar fechamento
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
