"use client";

import { AlertTriangle, Loader2, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/currency-input";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useFormState } from "@/hooks/use-form-state";
import { openCashRegisterAction } from "../~actions/actions";

export function OpenCashRegisterForm() {
	const [{ success, title, errors }, handleOpen, isPending] = useFormState(
		openCashRegisterAction,
		() => {
			toast.success("Caixa aberto!", {
				description: "Bom expediente.",
			});
		}
	);

	return (
		<Card className="max-w-md">
			<CardHeader>
				<CardTitle>Abertura de caixa</CardTitle>
				<CardDescription>
					Informe o fundo de troco que está na gaveta para iniciar o dia.
				</CardDescription>
			</CardHeader>

			<CardContent>
				<form className="space-y-4" onSubmit={handleOpen}>
					{success === false && title && (
						<Alert variant="destructive">
							<AlertTriangle className="size-4" />
							<AlertTitle>{title}</AlertTitle>
						</Alert>
					)}

					<div className="space-y-3">
						<Label htmlFor="openingAmount">Fundo de troco (R$)</Label>

						<CurrencyInput id="openingAmount" name="openingAmount" />

						{errors?.openingAmount && (
							<p className="font-medium text-destructive text-xs">
								{errors.openingAmount[0]}
							</p>
						)}
					</div>

					<Button className="w-full" disabled={isPending} type="submit">
						{isPending ? (
							<Loader2 className="mr-2 size-4 animate-spin" />
						) : (
							<LockOpen className="mr-2 size-4" />
						)}
						Abrir caixa
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
