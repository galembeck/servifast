"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { getTab, type Tab } from "@/api/http/services/get-tab";
import { LiveUpdateError } from "@/components/live-update-error";
import { Button } from "@/components/ui/button";
import { useLiveQuery } from "@/hooks/use-live-query";
import { AddTabItemSheet } from "./add-tab-item-sheet";
import { SendToKitchenButton } from "./send-to-kitchen-button";
import { TabItemsList } from "./tab-items-list";

interface TabLiveViewProps {
	canCreateOrders: boolean;
	canForceCancelOrders: boolean;
	canUpdateOrders: boolean;
	currentRestaurant: string;
	menuItems: ComponentProps<typeof AddTabItemSheet>["menuItems"];
	slug: string;
	tab: Tab;
}

export function TabLiveView({
	canCreateOrders,
	canForceCancelOrders,
	canUpdateOrders,
	currentRestaurant,
	menuItems,
	slug,
	tab: serverTab,
}: TabLiveViewProps) {
	const { data: tab, isError } = useLiveQuery({
		queryKey: ["restaurants", currentRestaurant, "tabs", serverTab.id],
		queryFn: async () => (await getTab(currentRestaurant, serverTab.id)).tab,
		serverData: serverTab,
		enabled: serverTab.closedAt === null,
	});

	const isOpen = tab.closedAt === null;
	const canAddItems = canCreateOrders && isOpen;
	const canManageOrders = canUpdateOrders && isOpen;
	const canForceCancelItems = canForceCancelOrders && isOpen;

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
					<h1 className="font-semibold text-2xl">Comanda</h1>
					{tab.customerName && (
						<p className="text-muted-foreground text-sm">{tab.customerName}</p>
					)}
				</div>

				{(canAddItems || canManageOrders) && (
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
					</div>
				)}
			</div>

			{isError && <LiveUpdateError />}

			<TabItemsList
				canCancelItems={canManageOrders}
				canForceCancelItems={canForceCancelItems}
				items={tab.items}
				tabId={tab.id}
			/>
		</div>
	);
}
