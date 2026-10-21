"use client";

import { CheckCircle2, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import type { TabItem } from "@/api/http/services/get-tab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cancelTabItemAction } from "../~actions/actions";

const STATUS_LABEL: Record<TabItem["status"], string> = {
	RECEIVED: "Recebido",
	CANCELLED: "Cancelado",
};

const STATUS_VARIANT: Record<
	TabItem["status"],
	"default" | "secondary" | "outline" | "destructive"
> = {
	RECEIVED: "secondary",
	CANCELLED: "destructive",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

function formatPrice(priceInCents: number) {
	return currencyFormatter.format(priceInCents / 100);
}

interface TabItemsListProps {
	canCancelItems: boolean;
	items: TabItem[];
	tabId: string;
}

export function TabItemsList({
	canCancelItems,
	items,
	tabId,
}: TabItemsListProps) {
	const [cancelingItemId, setCancelingItemId] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function openCancelDialog(itemId: string) {
		setCancelingItemId(itemId);
		setErrorMessage(null);
	}

	function handleConfirmCancel() {
		if (!cancelingItemId) {
			return;
		}
		const itemId = cancelingItemId;
		startTransition(async () => {
			const result = await cancelTabItemAction(tabId, itemId);
			if (result.success) {
				setCancelingItemId(null);
			} else {
				setErrorMessage(result.title ?? "Erro ao cancelar o item.");
			}
		});
	}

	if (items.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Nenhum item adicionado ainda.
			</p>
		);
	}

	return (
		<>
			<div className="space-y-2">
				{items.map((item) => {
					const isCancelled = item.status === "CANCELLED";
					return (
						<Card key={item.id}>
							<CardContent
								className={`flex items-start justify-between gap-4 py-3 ${isCancelled ? "opacity-50" : ""}`}
							>
								<div className="space-y-0.5">
									<p
										className={`font-medium text-sm ${isCancelled ? "line-through" : ""}`}
									>
										{item.menuItem.name}
									</p>
									{item.notes && (
										<p className="text-muted-foreground text-xs">
											{item.notes}
										</p>
									)}
								</div>

								<div className="flex shrink-0 flex-col items-end gap-1">
									<p
										className={`font-medium text-sm ${isCancelled ? "line-through" : ""}`}
									>
										{item.quantity}× {formatPrice(item.unitPriceInCents)}
									</p>
									<div className="flex items-center gap-2">
										{item.sentToKitchenAt !== null && !isCancelled && (
											<span className="flex items-center gap-1 text-green-600 text-xs dark:text-green-400">
												<CheckCircle2 className="size-3" />
												Na cozinha
											</span>
										)}
										<Badge variant={STATUS_VARIANT[item.status]}>
											{STATUS_LABEL[item.status]}
										</Badge>
										{canCancelItems && !isCancelled && (
											<Button
												onClick={() => openCancelDialog(item.id)}
												size="icon-sm"
												type="button"
												variant="ghost"
											>
												<X className="size-3" />
												<span className="sr-only">Cancelar item</span>
											</Button>
										)}
									</div>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			<Dialog
				onOpenChange={(open) => !open && setCancelingItemId(null)}
				open={cancelingItemId !== null}
			>
				<DialogContent showCloseButton={!isPending}>
					<DialogHeader>
						<DialogTitle>Cancelar item</DialogTitle>
						<DialogDescription>
							Tem certeza que deseja cancelar este item? Esta ação não pode ser
							desfeita.
						</DialogDescription>
					</DialogHeader>

					{errorMessage && (
						<p className="text-destructive text-sm">{errorMessage}</p>
					)}

					<DialogFooter>
						<Button
							disabled={isPending}
							onClick={() => setCancelingItemId(null)}
							type="button"
							variant="outline"
						>
							Voltar
						</Button>
						<Button
							disabled={isPending}
							onClick={handleConfirmCancel}
							type="button"
							variant="destructive"
						>
							{isPending ? (
								<span className="flex items-center gap-2">
									<Loader2 className="size-4 animate-spin" />
									Cancelando...
								</span>
							) : (
								"Confirmar cancelamento"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
