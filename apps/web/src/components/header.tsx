import { Slash } from "lucide-react";
import Link from "next/link";
import { ability, getCurrentRestaurant } from "@/providers/auth-provider";
import { RocketseatIcon } from "./icons/rocketseat-icon";
import { PendingInvites } from "./pending-invites";
import { ProfileButton } from "./profile-button";
import { RestaurantSwitch } from "./restaurant-switch";
import { StockAlertsBell } from "./stock-alerts/stock-alerts-bell";
import { ThemeToggle } from "./theme/theme-toggle";
import { Separator } from "./ui/separator";

export async function Header() {
	const currentRestaurant = await getCurrentRestaurant();
	const permissions = currentRestaurant ? await ability() : null;
	const canGetStockAlerts = !!permissions?.can("get", "Stock");

	return (
		<div className="mx-auto flex max-w-300 items-center justify-between">
			<div className="flex items-center gap-3">
				<Link href="/">
					<RocketseatIcon className="size-6 dark:invert" />
				</Link>

				<Slash className="size-3 rotate-[-24deg] text-border" />

				<RestaurantSwitch />
			</div>

			<div className="flex items-center gap-4">
				{currentRestaurant && canGetStockAlerts && (
					<StockAlertsBell slug={currentRestaurant} />
				)}

				<PendingInvites />

				<ThemeToggle />

				<Separator orientation="vertical" />

				<ProfileButton />
			</div>
		</div>
	);
}
