import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMenuItems } from "@/api/http/services/get-menu-items";
import { getTab } from "@/api/http/services/get-tab";
import { Button } from "@/components/ui/button";
import { ability, getCurrentRestaurant } from "@/providers/auth-provider";
import { AddTabItemSheet } from "./~components/add-tab-item-sheet";
import { SendToKitchenButton } from "./~components/send-to-kitchen-button";
import { TabItemsList } from "./~components/tab-items-list";

export default async function TabPage({
	params,
}: {
	params: Promise<{ slug: string; tabId: string }>;
}) {
	const { slug, tabId } = await params;
	const permissions = await ability();

	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	const tabResult = await getTab(currentRestaurant, tabId).catch(() => null);
	if (!tabResult) {
		notFound();
	}
	const { tab } = tabResult;

	const canAddItems =
		!!permissions?.can("create", "Order") && tab.closedAt === null;
	const canManageOrders =
		!!permissions?.can("update", "Order") && tab.closedAt === null;

	const pendingItemsCount = tab.items.filter(
		(item) => item.status === "RECEIVED" && item.sentToKitchenAt === null
	).length;

	const { items: menuItems } = canAddItems
		? await getMenuItems(currentRestaurant, { available: true })
		: { items: [] };

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
								tabId={tabId}
							/>
						)}
						{canAddItems && (
							<AddTabItemSheet
								items={tab.items}
								menuItems={menuItems}
								tabId={tabId}
							/>
						)}
					</div>
				)}
			</div>

			<TabItemsList
				canCancelItems={canManageOrders}
				items={tab.items}
				tabId={tabId}
			/>
		</div>
	);
}
