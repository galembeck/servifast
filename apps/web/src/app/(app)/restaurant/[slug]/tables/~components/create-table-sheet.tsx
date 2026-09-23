"use client";

import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useFormState } from "@/hooks/use-form-state";
import { createTableAction } from "../~actions/actions";

export function CreateTableSheet() {
	const [open, setOpen] = useState(false);

	const [
		{ success, title, description, errors },
		handleCreateTable,
		isPending,
	] = useFormState(createTableAction, () => {
		setOpen(false);
	});

	return (
		<Sheet onOpenChange={setOpen} open={open}>
			<SheetTrigger asChild>
				<Button size="sm">
					<Plus className="mr-2 size-4" />
					Adicionar mesa
				</Button>
			</SheetTrigger>

			<SheetContent>
				<SheetHeader>
					<SheetTitle>Adicionar mesa</SheetTitle>
				</SheetHeader>

				<form
					className="space-y-4 px-4"
					id="create-table-form"
					onSubmit={handleCreateTable}
				>
					{success === false && (title ?? description) && (
						<Alert variant="destructive">
							<AlertTriangle className="size-4" />

							<AlertTitle>{title ?? "Erro ao criar mesa!"}</AlertTitle>

							{description && (
								<AlertDescription>
									<p>{description}</p>
								</AlertDescription>
							)}
						</Alert>
					)}

					<div className="space-y-3">
						<Label htmlFor="number">Número da mesa</Label>

						<Input
							id="number"
							inputMode="numeric"
							min={1}
							name="number"
							type="number"
						/>

						{errors?.number && (
							<p className="font-medium text-destructive text-xs">
								{errors.number[0]}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Label htmlFor="positionReference">Referência de posição</Label>

						<Input
							id="positionReference"
							name="positionReference"
							placeholder="Ex.: Perto da janela"
						/>

						{errors?.positionReference && (
							<p className="font-medium text-destructive text-xs">
								{errors.positionReference[0]}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Label htmlFor="seatsCount">Quantidade de lugares</Label>

						<Input
							id="seatsCount"
							inputMode="numeric"
							min={1}
							name="seatsCount"
							type="number"
						/>

						{errors?.seatsCount && (
							<p className="font-medium text-destructive text-xs">
								{errors.seatsCount[0]}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Label htmlFor="observations">Observações</Label>

						<Textarea
							id="observations"
							name="observations"
							placeholder="Ex.: Mesa acessível para cadeirantes"
						/>

						{errors?.observations && (
							<p className="font-medium text-destructive text-xs">
								{errors.observations[0]}
							</p>
						)}
					</div>

					<Button className="w-full" disabled={isPending} type="submit">
						{isPending ? (
							<span className="flex items-center gap-2">
								<Loader2 className="size-4 animate-spin" />
								Salvando...
							</span>
						) : (
							"Salvar mesa"
						)}
					</Button>
				</form>
			</SheetContent>
		</Sheet>
	);
}
