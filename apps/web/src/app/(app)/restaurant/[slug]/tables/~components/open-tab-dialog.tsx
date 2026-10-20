"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormState } from "@/hooks/use-form-state";
import { openTabAction } from "../~actions/actions";

interface OpenTabDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	tableId: string;
	tableNumber: number;
}

export function OpenTabDialog({
	open,
	onOpenChange,
	tableId,
	tableNumber,
}: OpenTabDialogProps) {
	const [{ success, title, description, errors }, handleOpenTab, isPending] =
		useFormState(openTabAction, () => {
			onOpenChange(false);
		});

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Abrir comanda — Mesa {tableNumber}</DialogTitle>
				</DialogHeader>

				<form className="space-y-4" id="open-tab-form" onSubmit={handleOpenTab}>
					<input name="tableId" type="hidden" value={tableId} />

					{success === false && (title ?? description) && (
						<Alert variant="destructive">
							<AlertTriangle className="size-4" />

							<AlertTitle>
								{title ?? "Não foi possível abrir a comanda."}
							</AlertTitle>

							{description && (
								<AlertDescription>
									<p>{description}</p>
								</AlertDescription>
							)}
						</Alert>
					)}

					<div className="space-y-2">
						<Label htmlFor="customerName">
							Cliente{" "}
							<span className="text-muted-foreground text-xs">(opcional)</span>
						</Label>

						<Input
							id="customerName"
							name="customerName"
							placeholder="Ex.: João Silva"
						/>

						{errors?.customerName && (
							<p className="font-medium text-destructive text-xs">
								{errors.customerName[0]}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="peopleCount">
							Quantidade de pessoas{" "}
							<span className="text-muted-foreground text-xs">(opcional)</span>
						</Label>

						<Input
							id="peopleCount"
							inputMode="numeric"
							min={1}
							name="peopleCount"
							type="number"
						/>

						{errors?.peopleCount && (
							<p className="font-medium text-destructive text-xs">
								{errors.peopleCount[0]}
							</p>
						)}
					</div>

					<DialogFooter>
						<Button
							disabled={isPending}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancelar
						</Button>

						<Button disabled={isPending} type="submit">
							{isPending ? (
								<span className="flex items-center gap-2">
									<Loader2 className="size-4 animate-spin" />
									Abrindo...
								</span>
							) : (
								"Confirmar"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
