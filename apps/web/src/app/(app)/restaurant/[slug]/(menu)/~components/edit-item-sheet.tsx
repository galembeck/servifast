"use client";

import { AlertTriangle, Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { CurrencyInput } from "@/components/currency-input";
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
import { updateMenuItemAction } from "../~actions/actions";

interface EditItemSheetProps {
	categories: { id: string; name: string }[];
	item: {
		categoryId: string;
		description: string | null;
		id: string;
		isAvailable: boolean;
		name: string;
		priceInCents: number;
	};
}

export function EditItemSheet({ categories, item }: EditItemSheetProps) {
	const [open, setOpen] = useState(false);

	const [{ success, title, description, errors }, handleUpdateItem, isPending] =
		useFormState(updateMenuItemAction, () => {
			setOpen(false);
		});

	return (
		<Sheet onOpenChange={setOpen} open={open}>
			<SheetTrigger asChild>
				<Button className="w-full" size="sm" variant="outline">
					<Pencil className="mr-2 size-4" />
					Editar informações
				</Button>
			</SheetTrigger>

			<SheetContent>
				<SheetHeader>
					<SheetTitle>Editar produto</SheetTitle>
				</SheetHeader>

				<form
					className="space-y-4 px-4"
					id="edit-item-form"
					onSubmit={handleUpdateItem}
				>
					{success === false && (title ?? description) && (
						<Alert variant="destructive">
							<AlertTriangle className="size-4" />

							<AlertTitle>{title ?? "Erro ao atualizar produto!"}</AlertTitle>

							{description && (
								<AlertDescription>
									<p>{description}</p>
								</AlertDescription>
							)}
						</Alert>
					)}

					<input name="itemId" type="hidden" value={item.id} />

					{!item.isAvailable && (
						<input name="markAsUnavailable" type="hidden" value="on" />
					)}

					<div className="space-y-3">
						<Label htmlFor="name">Nome do produto</Label>

						<Input
							defaultValue={item.name}
							id="name"
							name="name"
							placeholder="Ex.: X-Burguer"
						/>

						{errors?.name && (
							<p className="font-medium text-destructive text-xs">
								{errors.name[0]}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Label htmlFor="description">Descrição</Label>

						<Textarea
							defaultValue={item.description ?? ""}
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

						<CurrencyInput
							defaultValueInCents={item.priceInCents}
							id="price"
							name="price"
						/>

						{errors?.price && (
							<p className="font-medium text-destructive text-xs">
								{errors.price[0]}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Label htmlFor="categoryId">Categoria</Label>

						<Select defaultValue={item.categoryId} name="categoryId">
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
							"Salvar alterações"
						)}
					</Button>
				</form>
			</SheetContent>
		</Sheet>
	);
}
