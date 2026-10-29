"use client";

import { CheckCircle2, Loader2, OctagonX, X } from "lucide-react";
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
	canForceCancelItems: boolean;
	items: TabItem[];
	tabId: string;
}

interface CancelingItem {
	force: boolean;
	id: string;
}

export function TabItemsList({
	canCancelItems,
	canForceCancelItems,
	items,
	tabId,
}: TabItemsListProps) {
	const [cancelingItem, setCancelingItem] = useState<CancelingItem | null>(
		null
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const isForcedCancellation = cancelingItem?.force ?? false;
	const confirmLabel = isForcedCancellation
		? "Forçar cancelamento"
		: "Confirmar cancelamento";

	function openCancelDialog(id: string, force: boolean) {
		setCancelingItem({ id, force });
		setErrorMessage(null);
	}

	function handleConfirmCancel() {
		if (!cancelingItem) {
			return;
		}
		const { id, force } = cancelingItem;
		startTransition(async () => {
			const result = await cancelTabItemAction(tabId, id, force);
			if (result.success) {
				setCancelingItem(null);
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
					const isSentToKitchen = item.sentToKitchenAt !== null;
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
										{isSentToKitchen && !isCancelled && (
											<span className="flex items-center gap-1 text-green-600 text-xs dark:text-green-400">
												<CheckCircle2 className="size-3" />
												Na cozinha
											</span>
										)}
										<Badge variant={STATUS_VARIANT[item.status]}>
											{STATUS_LABEL[item.status]}
										</Badge>
										{canCancelItems && !isCancelled && !isSentToKitchen && (
											<Button
												onClick={() => openCancelDialog(item.id, false)}
												size="icon-sm"
												type="button"
												variant="ghost"
											>
												<X className="size-3" />
												<span className="sr-only">Cancelar item</span>
											</Button>
										)}
										{canForceCancelItems && !isCancelled && isSentToKitchen && (
											<Button
												className="text-destructive"
												onClick={() => openCancelDialog(item.id, true)}
												size="icon-sm"
												title="Forçar cancelamento"
												type="button"
												variant="ghost"
											>
												<OctagonX className="size-3" />
												<span className="sr-only">Forçar cancelamento</span>
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
				onOpenChange={(open) => !open && setCancelingItem(null)}
				open={cancelingItem !== null}
			>
				<DialogContent showCloseButton={!isPending}>
					<DialogHeader>
						<DialogTitle
							className={isForcedCancellation ? "text-destructive" : undefined}
						>
							{isForcedCancellation ? "Cancelamento forçado" : "Cancelar item"}
						</DialogTitle>
						<DialogDescription>
							{isForcedCancellation
								? "Este item já foi enviado para a cozinha e pode já estar sendo preparado. A cozinha não será avisada automaticamente: comunique o cancelamento à equipe. Esta ação não pode ser desfeita."
								: "Tem certeza que deseja cancelar este item? Esta ação não pode ser desfeita."}
						</DialogDescription>
					</DialogHeader>

					{errorMessage && (
						<p className="text-destructive text-sm">{errorMessage}</p>
					)}

					<DialogFooter>
						<Button
							disabled={isPending}
							onClick={() => setCancelingItem(null)}
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
								confirmLabel
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
