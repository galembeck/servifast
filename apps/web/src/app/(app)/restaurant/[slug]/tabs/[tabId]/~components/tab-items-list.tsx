"use client";

import {
	BellRing,
	CheckCircle2,
	HandPlatter,
	Loader2,
	OctagonX,
	X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { cancelTabItemAction, deliverTabItemAction } from "../~actions/actions";

const STATUS_LABEL: Record<TabItem["status"], string> = {
	RECEIVED: "Recebido",
	PREPARING: "Em preparo",
	READY: "Pronto",
	DELIVERED: "Entregue",
	CANCELLED: "Cancelado",
};

const READY_BADGE_CLASS = "bg-emerald-600 text-white dark:bg-emerald-500";

const deliveredAtFormatter = new Intl.DateTimeFormat("pt-BR", {
	hour: "2-digit",
	minute: "2-digit",
});

const STATUS_VARIANT: Record<
	TabItem["status"],
	"default" | "secondary" | "outline" | "destructive"
> = {
	RECEIVED: "secondary",
	PREPARING: "outline",
	READY: "default",
	DELIVERED: "outline",
	CANCELLED: "destructive",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

function formatPrice(priceInCents: number) {
	return currencyFormatter.format(priceInCents / 100);
}

interface TabItemRowProps {
	canCancel: boolean;
	canDeliver: boolean;
	canForceCancel: boolean;
	isDelivering: boolean;
	isThisDelivering: boolean;
	item: TabItem;
	onCancel: (force: boolean) => void;
	onDeliver: () => void;
}

function TabItemRow({
	canCancel,
	canDeliver,
	canForceCancel,
	isDelivering,
	isThisDelivering,
	item,
	onCancel,
	onDeliver,
}: TabItemRowProps) {
	const isCancelled = item.status === "CANCELLED";
	const isReady = item.status === "READY";
	const isInKitchen =
		item.sentToKitchenAt !== null &&
		(item.status === "RECEIVED" || item.status === "PREPARING");
	const struckThrough = isCancelled ? "line-through" : "";

	return (
		<Card
			className={
				isReady
					? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/40"
					: undefined
			}
		>
			<CardContent
				className={`flex items-start justify-between gap-4 py-3 ${isCancelled ? "opacity-50" : ""}`}
			>
				<div className="space-y-0.5">
					<p className={`font-medium text-sm ${struckThrough}`}>
						{item.menuItem.name}
					</p>
					{item.notes && (
						<p className="text-muted-foreground text-xs">{item.notes}</p>
					)}
				</div>

				<div className="flex shrink-0 flex-col items-end gap-1">
					<p className={`font-medium text-sm ${struckThrough}`}>
						{item.quantity}× {formatPrice(item.unitPriceInCents)}
					</p>
					<div className="flex items-center gap-2">
						{isInKitchen && (
							<span className="flex items-center gap-1 text-green-600 text-xs dark:text-green-400">
								<CheckCircle2 className="size-3" />
								Na cozinha
							</span>
						)}
						{item.status === "DELIVERED" && item.deliveredAt && (
							<span className="text-muted-foreground text-xs">
								às {deliveredAtFormatter.format(new Date(item.deliveredAt))}
							</span>
						)}
						<Badge
							className={isReady ? READY_BADGE_CLASS : undefined}
							variant={STATUS_VARIANT[item.status]}
						>
							{STATUS_LABEL[item.status]}
						</Badge>
						{canCancel && (
							<Button
								onClick={() => onCancel(false)}
								size="icon-sm"
								type="button"
								variant="ghost"
							>
								<X className="size-3" />
								<span className="sr-only">Cancelar item</span>
							</Button>
						)}
						{canForceCancel && (
							<Button
								className="text-destructive"
								onClick={() => onCancel(true)}
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
					{canDeliver && (
						<Button
							className="mt-1 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
							disabled={isDelivering}
							onClick={onDeliver}
							size="sm"
							type="button"
						>
							{isThisDelivering ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<HandPlatter className="size-4" />
							)}
							Marcar como entregue
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

interface TabItemsListProps {
	canCancelItems: boolean;
	canDeliverItems: boolean;
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
	canDeliverItems,
	canForceCancelItems,
	items,
	tabId,
}: TabItemsListProps) {
	const [cancelingItem, setCancelingItem] = useState<CancelingItem | null>(
		null
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [deliveringItemId, setDeliveringItemId] = useState<string | null>(null);
	const [isDelivering, startDeliverTransition] = useTransition();

	const readyItemsCount = items.filter(
		(item) => item.status === "READY"
	).length;

	function handleDeliver(itemId: string) {
		setDeliveringItemId(itemId);
		startDeliverTransition(async () => {
			const result = await deliverTabItemAction(tabId, itemId);
			if (result.success) {
				toast.success(result.title);
			} else {
				toast.error(result.title);
			}
			setDeliveringItemId(null);
		});
	}

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
			{readyItemsCount > 0 && (
				<div
					className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500/10 px-4 py-3 font-medium text-emerald-800 text-sm dark:text-emerald-300"
					role="status"
				>
					<BellRing className="size-4 shrink-0" />
					{readyItemsCount === 1
						? "1 item pronto para retirar na cozinha."
						: `${readyItemsCount} itens prontos para retirar na cozinha.`}
				</div>
			)}

			<div className="space-y-2">
				{items.map((item) => {
					const isSentToKitchen = item.sentToKitchenAt !== null;
					const isActive = item.status !== "CANCELLED";
					return (
						<TabItemRow
							canCancel={canCancelItems && isActive && !isSentToKitchen}
							canDeliver={canDeliverItems && item.status === "READY"}
							canForceCancel={
								canForceCancelItems &&
								item.status === "RECEIVED" &&
								isSentToKitchen
							}
							isDelivering={isDelivering}
							isThisDelivering={isDelivering && deliveringItemId === item.id}
							item={item}
							key={item.id}
							onCancel={(force) => openCancelDialog(item.id, force)}
							onDeliver={() => handleDeliver(item.id)}
						/>
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
