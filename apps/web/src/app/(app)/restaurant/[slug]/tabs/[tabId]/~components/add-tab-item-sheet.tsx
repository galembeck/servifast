"use client";

import { AlertTriangle, Loader2, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import type { TabItem } from "@/api/http/services/get-tab";
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
import { addTabItemAction } from "../~actions/actions";

interface MenuItem {
	categoryId: string;
	description: string | null;
	id: string;
	imageUrl: string | null;
	isAvailable: boolean;
	name: string;
	priceInCents: number;
}

interface AddTabItemSheetProps {
	items: TabItem[];
	menuItems: MenuItem[];
	tabId: string;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

function formatPrice(priceInCents: number) {
	return currencyFormatter.format(priceInCents / 100);
}

export function AddTabItemSheet({ tabId, menuItems }: AddTabItemSheetProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
	const [quantity, setQuantity] = useState(1);

	const [{ success, title, description, errors }, handleSubmit, isPending] =
		useFormState(addTabItemAction, () => {
			setOpen(false);
			setSelectedItem(null);
			setQuantity(1);
			setSearch("");
		});

	const availableItems = menuItems.filter(
		(item) =>
			item.isAvailable && item.name.toLowerCase().includes(search.toLowerCase())
	);

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (!next) {
			setSelectedItem(null);
			setQuantity(1);
			setSearch("");
		}
	}

	return (
		<Sheet onOpenChange={handleOpenChange} open={open}>
			<SheetTrigger asChild>
				<Button size="sm">
					<ShoppingBag className="mr-2 size-4" />
					Adicionar item
				</Button>
			</SheetTrigger>

			<SheetContent>
				<SheetHeader>
					<SheetTitle>Adicionar item à comanda</SheetTitle>
				</SheetHeader>

				<form
					className="space-y-4 px-4"
					id="add-tab-item-form"
					onSubmit={handleSubmit}
				>
					<input name="tabId" type="hidden" value={tabId} />

					{selectedItem && (
						<input name="menuItemId" type="hidden" value={selectedItem.id} />
					)}

					{success === false && (title ?? description) && (
						<Alert variant="destructive">
							<AlertTriangle className="size-4" />
							<AlertTitle>
								{title ?? "Não foi possível adicionar o item."}
							</AlertTitle>
							{description && (
								<AlertDescription>
									<p>{description}</p>
								</AlertDescription>
							)}
						</Alert>
					)}

					<div className="space-y-2">
						<Label htmlFor="search">Buscar produto</Label>
						<Input
							id="search"
							onChange={(e) => {
								setSearch(e.target.value);
								setSelectedItem(null);
							}}
							placeholder="Ex.: X-Burguer"
							value={search}
						/>
					</div>

					<div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-1">
						{availableItems.length === 0 ? (
							<p className="p-2 text-center text-muted-foreground text-sm">
								Nenhum produto disponível encontrado.
							</p>
						) : (
							availableItems.map((item) => (
								<button
									className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
										selectedItem?.id === item.id ? "bg-accent font-medium" : ""
									}`}
									key={item.id}
									onClick={() => setSelectedItem(item)}
									type="button"
								>
									<span>{item.name}</span>
									<span className="text-muted-foreground">
										{formatPrice(item.priceInCents)}
									</span>
								</button>
							))
						)}
					</div>

					{errors?.menuItemId && (
						<p className="font-medium text-destructive text-xs">
							Selecione um produto.
						</p>
					)}

					<div className="space-y-2">
						<Label>Quantidade</Label>
						<input name="quantity" type="hidden" value={quantity} />
						<div className="flex items-center gap-3">
							<Button
								disabled={quantity <= 1}
								onClick={() => setQuantity((q) => Math.max(1, q - 1))}
								size="icon-sm"
								type="button"
								variant="outline"
							>
								<Minus className="size-3" />
							</Button>
							<span className="w-8 text-center font-medium tabular-nums">
								{quantity}
							</span>
							<Button
								onClick={() => setQuantity((q) => q + 1)}
								size="icon-sm"
								type="button"
								variant="outline"
							>
								<Plus className="size-3" />
							</Button>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="notes">
							Observações{" "}
							<span className="text-muted-foreground text-xs">(opcional)</span>
						</Label>
						<Textarea
							id="notes"
							maxLength={500}
							name="notes"
							placeholder="Ex.: Sem cebola, bem passado..."
						/>
						{errors?.notes && (
							<p className="font-medium text-destructive text-xs">
								{errors.notes[0]}
							</p>
						)}
					</div>

					<Button
						className="w-full"
						disabled={isPending || !selectedItem}
						type="submit"
					>
						{isPending ? (
							<span className="flex items-center gap-2">
								<Loader2 className="size-4 animate-spin" />
								Adicionando...
							</span>
						) : (
							"Confirmar"
						)}
					</Button>
				</form>
			</SheetContent>
		</Sheet>
	);
}
