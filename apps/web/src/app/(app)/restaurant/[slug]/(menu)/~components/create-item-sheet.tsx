"use client";

import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useFormState } from "@/hooks/use-form-state";
import { createMenuItemAction } from "../~actions/actions";

interface CreateItemSheetProps {
	categories: { id: string; name: string }[];
}

export function CreateItemSheet({ categories }: CreateItemSheetProps) {
	const [open, setOpen] = useState(false);

	const [{ success, title, description, errors }, handleCreateItem, isPending] =
		useFormState(createMenuItemAction, () => {
			setOpen(false);
		});

	return (
		<Sheet onOpenChange={setOpen} open={open}>
			<SheetTrigger asChild>
				<Button disabled={categories.length === 0} size="sm">
					<Plus className="mr-2 size-4" />
					Adicionar produto
				</Button>
			</SheetTrigger>

			<SheetContent>
				<SheetHeader>
					<SheetTitle>Adicionar produto</SheetTitle>
				</SheetHeader>

				<form
					className="space-y-4 px-4"
					id="create-item-form"
					onSubmit={handleCreateItem}
				>
					{success === false && (title ?? description) && (
						<Alert variant="destructive">
							<AlertTriangle className="size-4" />

							<AlertTitle>{title ?? "Erro ao criar produto!"}</AlertTitle>

							{description && (
								<AlertDescription>
									<p>{description}</p>
								</AlertDescription>
							)}
						</Alert>
					)}

					<div className="space-y-3">
						<Label htmlFor="name">Nome do produto</Label>

						<Input id="name" name="name" placeholder="Ex.: X-Burguer" />

						{errors?.name && (
							<p className="font-medium text-destructive text-xs">
								{errors.name[0]}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Label htmlFor="description">Descrição</Label>

						<Textarea
							id="description"
							name="description"
							placeholder="Ex.: Pão, hambúrguer, queijo e salada"
						/>

						{errors?.description && (
							<p className="font-medium text-destructive text-xs">
								{errors.description[0]}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Label htmlFor="price">Preço (R$)</Label>

						<Input
							id="price"
							inputMode="decimal"
							min={0}
							name="price"
							placeholder="Ex.: 24.90"
							step="0.01"
							type="number"
						/>

						{errors?.price && (
							<p className="font-medium text-destructive text-xs">
								{errors.price[0]}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Label htmlFor="categoryId">Categoria</Label>

						<Select name="categoryId">
							<SelectTrigger className="w-full" id="categoryId">
								<SelectValue placeholder="Selecione uma categoria" />
							</SelectTrigger>

							<SelectContent>
								{categories.map((category) => (
									<SelectItem key={category.id} value={category.id}>
										{category.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{errors?.categoryId && (
							<p className="font-medium text-destructive text-xs">
								{errors.categoryId[0]}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Label htmlFor="image">Imagem</Label>

						<Input accept="image/*" id="image" name="image" type="file" />

						{errors?.image && (
							<p className="font-medium text-destructive text-xs">
								{errors.image[0]}
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
							"Salvar produto"
						)}
					</Button>
				</form>
			</SheetContent>
		</Sheet>
	);
}
