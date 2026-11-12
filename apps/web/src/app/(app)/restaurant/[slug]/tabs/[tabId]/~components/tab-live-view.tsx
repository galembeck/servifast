"use client";

import { ArrowLeft, ScrollText } from "lucide-react";
import Link from "next/link";
import { type ComponentProps, useState } from "react";
import { getTab, type Tab } from "@/api/http/services/get-tab";
import { BillDialog } from "@/components/bill-dialog";
import { OfflineIndicator } from "@/components/offline-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLiveQuery } from "@/hooks/use-live-query";
import { AddTabItemSheet } from "./add-tab-item-sheet";
import { CloseTabDialog } from "./close-tab-dialog";
import { RequestBillButton } from "./request-bill-button";
import { SendToKitchenButton } from "./send-to-kitchen-button";
import { TabItemsList } from "./tab-items-list";

interface TabLiveViewProps {
	canCloseTab: boolean;
	canCreateOrders: boolean;
	canDeliverOrders: boolean;
	canForceCancelOrders: boolean;
	canRequestBill: boolean;
	canUpdateOrders: boolean;
	canViewBill: boolean;
	currentRestaurant: string;
	menuItems: ComponentProps<typeof AddTabItemSheet>["menuItems"];
	slug: string;
	tab: Tab;
}

export function TabLiveView({
	canCloseTab,
	canCreateOrders,
	canDeliverOrders,
	canForceCancelOrders,
	canRequestBill,
	canUpdateOrders,
	canViewBill,
	currentRestaurant,
	menuItems,
	slug,
	tab: serverTab,
}: TabLiveViewProps) {
	const { data: tab, isOffline } = useLiveQuery({
		queryKey: ["restaurants", currentRestaurant, "tabs", serverTab.id],
		queryFn: async () => (await getTab(currentRestaurant, serverTab.id)).tab,
		serverData: serverTab,
		enabled: serverTab.closedAt === null,
	});

	const [isBillOpen, setIsBillOpen] = useState(false);
	const isOpen = tab.closedAt === null;
	const canViewThisBill = canViewBill && isOpen;
	const canAddItems = canCreateOrders && isOpen;
	const canManageOrders = canUpdateOrders && isOpen;
	const canForceCancelItems = canForceCancelOrders && isOpen;
	const canDeliverItems = canDeliverOrders && isOpen;
	const canCloseThisTab = canCloseTab && isOpen;
	const isBillRequested = tab.table.status === "BILL_REQUESTED";
	const canRequestThisBill =
		canRequestBill && isOpen && tab.table.status === "OCCUPIED";

	const pendingItemsCount = tab.items.filter(
		(item) => item.status === "RECEIVED" && item.sentToKitchenAt === null
	).length;

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<Button asChild size="icon-sm" variant="ghost">
					<Link href={`/restaurant/${slug}/tables`}>
						<ArrowLeft className="size-4" />
						<span className="sr-only">Voltar</span>
					</Link>
				</Button>

				<div>
					<h1 className="flex items-center gap-2 font-semibold text-2xl">
						Comanda · Mesa {tab.table.number}
						{isOpen && isBillRequested && (
							<Badge className="bg-amber-500 text-white">Conta pedida</Badge>
						)}
					</h1>
					{tab.customerName && (
						<p className="text-muted-foreground text-sm">{tab.customerName}</p>
					)}
				</div>

				{(canAddItems ||
					canManageOrders ||
					canRequestThisBill ||
					canViewThisBill ||
					canCloseThisTab) && (
					<div className="ml-auto flex items-center gap-2">
						{canManageOrders && (
							<SendToKitchenButton
								pendingCount={pendingItemsCount}
								tabId={tab.id}
							/>
						)}
						{canAddItems && (
							<AddTabItemSheet
								items={tab.items}
								menuItems={menuItems}
								tabId={tab.id}
							/>
						)}
						{canViewThisBill && (
							<Button
								onClick={() => setIsBillOpen(true)}
								type="button"
								variant="outline"
							>
								<ScrollText className="mr-2 size-4" />
								Ver conta
							</Button>
						)}
						{canRequestThisBill && <RequestBillButton tabId={tab.id} />}
						{canCloseThisTab && (
							<CloseTabDialog items={tab.items} slug={slug} tabId={tab.id} />
						)}
					</div>
				)}
			</div>

			{isOffline && <OfflineIndicator />}

			{!isOpen && (
				<p className="rounded-md border bg-muted px-4 py-3 text-muted-foreground text-sm">
					Esta comanda foi encerrada.
				</p>
			)}

			{canViewThisBill && (
				<BillDialog
					currentRestaurant={currentRestaurant}
					onOpenChange={setIsBillOpen}
					open={isBillOpen}
					tableId={tab.tableId}
					tableNumber={tab.table.number}
				/>
			)}

			<TabItemsList
				canCancelItems={canManageOrders}
				canDeliverItems={canDeliverItems}
				canForceCancelItems={canForceCancelItems}
				items={tab.items}
				tabId={tab.id}
			/>
		</div>
	);
}
