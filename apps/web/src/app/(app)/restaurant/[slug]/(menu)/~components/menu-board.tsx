"use client";

import { env } from "@repo/env";
import { Trash2, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
	deleteMenuItemAction,
	toggleMenuItemAvailabilityAction,
} from "../~actions/actions";
import { CreateCategorySheet } from "./create-category-sheet";
import { CreateItemSheet } from "./create-item-sheet";
import { EditItemSheet } from "./edit-item-sheet";

interface MenuCategory {
	id: string;
	name: string;
}

interface MenuItem {
	categoryId: string;
	description: string | null;
	id: string;
	imageUrl: string | null;
	isAvailable: boolean;
	name: string;
	priceInCents: number;
}

interface MenuBoardProps {
	canCreateCategory: boolean;
	canCreateItem: boolean;
	canDeleteItem: boolean;
	canUpdateItem: boolean;
	categories: MenuCategory[];
	items: MenuItem[];
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

function formatPrice(priceInCents: number) {
	return currencyFormatter.format(priceInCents / 100);
}

function resolveImageUrl(imageUrl: string | null) {
	if (!imageUrl) {
		return null;
	}

	return `${env.NEXT_PUBLIC_API_URL}${imageUrl}`;
}

function ItemImage({
	imageUrl,
	name,
	className,
}: {
	className: string;
	imageUrl: string | null;
	name: string;
}) {
	const resolvedUrl = resolveImageUrl(imageUrl);

	if (!resolvedUrl) {
		return (
			<div
				className={cn(
					"flex items-center justify-center bg-muted text-muted-foreground",
					className
				)}
			>
				<UtensilsCrossed className="size-6" />
			</div>
		);
	}

	return (
		<div className={cn("relative overflow-hidden", className)}>
			<Image
				alt={name}
				className="object-cover"
				fill
				sizes="128px"
				src={resolvedUrl}
				unoptimized
			/>
		</div>
	);
}

function DetailPanel({
	item,
	categories,
	canUpdateItem,
	canDeleteItem,
}: {
	canDeleteItem: boolean;
	canUpdateItem: boolean;
	categories: MenuCategory[];
	item: MenuItem | null;
}) {
	const [isToggling, startTransition] = useTransition();

	if (!item) {
		return (
			<Card className="h-full items-center justify-center text-center">
				<CardContent className="text-muted-foreground text-sm">
					Selecione um produto para ver os detalhes.
				</CardContent>
			</Card>
		);
	}

	const currentItem = item;

	function handleToggleAvailability(markAsUnavailable: boolean) {
		startTransition(async () => {
			await toggleMenuItemAvailabilityAction({
				itemId: currentItem.id,
				name: currentItem.name,
				description: currentItem.description,
				price: currentItem.priceInCents / 100,
				categoryId: currentItem.categoryId,
				isAvailable: !markAsUnavailable,
			});
		});
	}

	return (
		<Card className="h-full">
			<CardContent className="flex flex-1 flex-col gap-4">
				<ItemImage
					className="aspect-video w-full rounded-lg"
					imageUrl={item.imageUrl}
					name={item.name}
				/>

				<div className="space-y-4">
					<div className="flex items-center justify-between gap-2">
						<h2 className="font-semibold text-lg">{item.name}</h2>

						{!item.isAvailable && (
							<Badge variant="destructive">Indisponível</Badge>
						)}
					</div>

					{item.description && (
						<p className="text-muted-foreground text-sm">{item.description}</p>
					)}
				</div>

				<p className="font-semibold text-xl">
					{formatPrice(item.priceInCents)}
				</p>

				{canUpdateItem && (
					<div className="flex items-baseline space-x-2">
						<Checkbox
							checked={!item.isAvailable}
							className="translate-y-0.5"
							disabled={isToggling}
							id="toggle-availability"
							onCheckedChange={(checked) =>
								handleToggleAvailability(checked === true)
							}
						/>

						<Label htmlFor="toggle-availability">
							Marcar produto como indisponível
						</Label>
					</div>
				)}

				{canUpdateItem && <EditItemSheet categories={categories} item={item} />}

				{canDeleteItem && (
					<form
						action={deleteMenuItemAction.bind(null, item.id)}
						className="mt-auto"
					>
						<Button className="w-full" type="submit" variant="destructive">
							<Trash2 className="mr-2 size-4" />
							Excluir produto
						</Button>
					</form>
				)}
			</CardContent>
		</Card>
	);
}

export function MenuBoard({
	categories,
	items,
	canCreateCategory,
	canCreateItem,
	canUpdateItem,
	canDeleteItem,
}: MenuBoardProps) {
	const [selectedCategoryId, setSelectedCategoryId] = useState(
		categories[0]?.id ?? null
	);
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

	const itemsInCategory = items.filter(
		(item) => item.categoryId === selectedCategoryId
	);
	const selectedItem =
		itemsInCategory.find((item) => item.id === selectedItemId) ?? null;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-4 border-b pb-4">
				<nav className="flex flex-wrap items-center gap-2">
					{categories.map((category) => (
						<Button
							className="border border-transparent text-muted-foreground data-[current=true]:border-border data-[current=true]:text-foreground"
							data-current={selectedCategoryId === category.id}
							key={category.id}
							onClick={() => setSelectedCategoryId(category.id)}
							size="sm"
							type="button"
							variant="ghost"
						>
							{category.name}
						</Button>
					))}

					{categories.length === 0 && (
						<p className="text-muted-foreground text-sm">
							Nenhuma categoria cadastrada ainda.
						</p>
					)}
				</nav>

				{canCreateCategory && <CreateCategorySheet />}
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div className="space-y-4 lg:col-span-2">
					{canCreateItem && <CreateItemSheet categories={categories} />}

					<div className="space-y-3">
						{itemsInCategory.map((item) => (
							<Card
								className={cn(
									"cursor-pointer flex-row p-0 transition-colors hover:bg-accent/50 data-[selected=true]:ring-2 data-[selected=true]:ring-ring",
									!item.isAvailable && "opacity-60"
								)}
								data-selected={selectedItemId === item.id}
								key={item.id}
								onClick={() => setSelectedItemId(item.id)}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										setSelectedItemId(item.id);
									}
								}}
								role="button"
								tabIndex={0}
							>
								<ItemImage
									className="aspect-square w-32 shrink-0 rounded-l-xl"
									imageUrl={item.imageUrl}
									name={item.name}
								/>

								<CardContent className="flex flex-1 flex-col justify-center gap-1 py-4">
									<div className="flex items-center justify-between gap-2">
										<h3 className="font-medium">{item.name}</h3>

										{!item.isAvailable && (
											<Badge variant="destructive">Indisponível</Badge>
										)}
									</div>

									{item.description && (
										<p className="line-clamp-2 text-muted-foreground text-sm">
											{item.description}
										</p>
									)}

									<p className="font-semibold">
										{formatPrice(item.priceInCents)}
									</p>
								</CardContent>
							</Card>
						))}

						{itemsInCategory.length === 0 && (
							<p className="text-muted-foreground text-sm">
								Nenhum produto cadastrado nesta categoria ainda.
							</p>
						)}
					</div>
				</div>

				<div className="lg:col-span-1">
					<DetailPanel
						canDeleteItem={canDeleteItem}
						canUpdateItem={canUpdateItem}
						categories={categories}
						item={selectedItem}
					/>
				</div>
			</div>
		</div>
	);
}
