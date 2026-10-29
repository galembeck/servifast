import { HTTPError } from "ky";
import { notFound } from "next/navigation";
import { getMenuItems } from "@/api/http/services/get-menu-items";
import { getTab } from "@/api/http/services/get-tab";
import { ability, getCurrentRestaurant } from "@/providers/auth-provider";
import { TabLiveView } from "./~components/tab-live-view";

const HTTP_NOT_FOUND = 404;

export default async function TabPage({
	params,
}: {
	params: Promise<{ slug: string; tabId: string }>;
}) {
	const { slug, tabId } = await params;
	const permissions = await ability();

	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	const tabResult = await getTab(currentRestaurant, tabId).catch(
		(error: unknown) => {
			// Only a real 404 means the tab doesn't exist; any other failure is
			// surfaced by the error boundary instead of a misleading "not found".
			if (
				error instanceof HTTPError &&
				error.response.status === HTTP_NOT_FOUND
			) {
				return null;
			}
			throw error;
		}
	);
	if (!tabResult) {
		notFound();
	}
	const { tab } = tabResult;

	const canCreateOrders = !!permissions?.can("create", "Order");

	const { items: menuItems } =
		canCreateOrders && tab.closedAt === null
			? await getMenuItems(currentRestaurant, { available: true })
			: { items: [] };

	return (
		<TabLiveView
			canCreateOrders={canCreateOrders}
			canForceCancelOrders={!!permissions?.can("force_cancel", "Order")}
			canUpdateOrders={!!permissions?.can("update", "Order")}
			currentRestaurant={currentRestaurant}
			menuItems={menuItems}
			slug={slug}
			tab={tab}
		/>
	);
}
