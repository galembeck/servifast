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
import { useFormState } from "@/hooks/use-form-state";
import { createMenuCategoryAction } from "../~actions/actions";

export function CreateCategorySheet() {
	const [open, setOpen] = useState(false);

	const [
		{ success, title, description, errors },
		handleCreateCategory,
		isPending,
	] = useFormState(createMenuCategoryAction, () => {
		setOpen(false);
	});

	return (
		<Sheet onOpenChange={setOpen} open={open}>
			<SheetTrigger asChild>
				<Button size="sm" variant="outline">
					<Plus className="mr-2 size-4" />
					Adicionar categoria
				</Button>
			</SheetTrigger>

			<SheetContent>
				<SheetHeader>
					<SheetTitle>Adicionar categoria</SheetTitle>
				</SheetHeader>

				<form
					className="space-y-4 px-4"
					id="create-category-form"
					onSubmit={handleCreateCategory}
				>
					{success === false && (title ?? description) && (
						<Alert variant="destructive">
							<AlertTriangle className="size-4" />

							<AlertTitle>{title ?? "Erro ao criar categoria!"}</AlertTitle>

							{description && (
								<AlertDescription>
									<p>{description}</p>
								</AlertDescription>
							)}
						</Alert>
					)}

					<div className="space-y-3">
						<Label htmlFor="name">Nome da categoria</Label>

						<Input id="name" name="name" placeholder="Ex.: Bebidas" />

						{errors?.name && (
							<p className="font-medium text-destructive text-xs">
								{errors.name[0]}
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
							"Salvar categoria"
						)}
					</Button>
				</form>
			</SheetContent>
		</Sheet>
	);
}
