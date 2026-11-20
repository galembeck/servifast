"use client";

import {
	AlertTriangle,
	ArrowDownToLine,
	ArrowUpFromLine,
	Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { CashMovementType } from "@/api/http/services/create-cash-register-transaction";
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
import { Textarea } from "@/components/ui/textarea";
import { useFormState } from "@/hooks/use-form-state";
import { createCashMovementAction } from "../~actions/actions";

const MOVEMENT_COPY: Record<
	CashMovementType,
	{
		description: string;
		icon: typeof ArrowDownToLine;
		placeholder: string;
		title: string;
	}
> = {
	SUPPLY: {
		title: "Suprimento",
		description: "Entrada de dinheiro na gaveta, como reforço do troco.",
		placeholder: "Ex.: Reforço de troco em moedas",
		icon: ArrowDownToLine,
	},
	WITHDRAWAL: {
		title: "Sangria",
		description:
			"Retirada de dinheiro da gaveta, como depósito ou pagamento de fornecedor.",
		placeholder: "Ex.: Depósito no banco",
		icon: ArrowUpFromLine,
	},
};

interface CashMovementDialogProps {
	type: CashMovementType;
}

export function CashMovementDialog({ type }: CashMovementDialogProps) {
	const [open, setOpen] = useState(false);
	const copy = MOVEMENT_COPY[type];
	const Icon = copy.icon;

	const [{ success, title, errors }, handleSubmit, isPending] = useFormState(
		createCashMovementAction,
		() => {
			toast.success(`${copy.title} registrad${type === "SUPPLY" ? "o" : "a"}!`);
			setOpen(false);
		}
	);

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>
				<Button
					className="h-auto flex-col gap-1 py-4"
					type="button"
					variant="outline"
				>
					<Icon className="size-5" />
					{copy.title}
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{copy.title}</DialogTitle>
					<DialogDescription>{copy.description}</DialogDescription>
				</DialogHeader>

				<form className="space-y-4" id={`cash-${type}`} onSubmit={handleSubmit}>
					<input name="type" type="hidden" value={type} />

					{success === false && title && (
						<Alert variant="destructive">
							<AlertTriangle className="size-4" />
							<AlertTitle>{title}</AlertTitle>
						</Alert>
					)}

					<div className="space-y-3">
						<Label htmlFor={`${type}-amount`}>Valor (R$)</Label>

						<CurrencyInput autoFocus id={`${type}-amount`} name="amount" />

						{errors?.amount && (
							<p className="font-medium text-destructive text-xs">
								{errors.amount[0]}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Label htmlFor={`${type}-description`}>Motivo (opcional)</Label>

						<Textarea
							id={`${type}-description`}
							maxLength={200}
							name="description"
							placeholder={copy.placeholder}
						/>

						{errors?.description && (
							<p className="font-medium text-destructive text-xs">
								{errors.description[0]}
							</p>
						)}
					</div>
				</form>

				<DialogFooter>
					<Button
						onClick={() => setOpen(false)}
						type="button"
						variant="outline"
					>
						Cancelar
					</Button>
					<Button disabled={isPending} form={`cash-${type}`} type="submit">
						{isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
						Registrar {copy.title.toLowerCase()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
