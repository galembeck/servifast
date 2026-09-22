import { ability, getCurrentRestaurant } from "@/providers/auth-provider";
import { NavLink } from "./nav-link";
import { Button } from "./ui/button";

export async function Tabs() {
	const currentRestaurant = await getCurrentRestaurant();

	const permissions = await ability();

	const canGetMembers = permissions?.can("get", "User");
	const canGetProjects = permissions?.can("get", "Project");

	const canUpdateRestaurant = permissions?.can("update", "Restaurant");
	const canGetBillingDetails = permissions?.can("get", "Billing");

	return (
		<div className="border-b py-4">
			<nav className="mx-auto flex max-w-300 items-center gap-2">
				{canGetProjects && (
					<Button
						asChild
						className="border border-transparent text-muted-foreground data-[current=true]:border-border data-[current=true]:text-foreground"
						size="sm"
						variant="ghost"
					>
						<NavLink href={`/restaurant/${currentRestaurant}`}>
							Projects
						</NavLink>
					</Button>
				)}

				{canGetMembers && (
					<Button
						asChild
						className="border border-transparent text-muted-foreground data-[current=true]:border-border data-[current=true]:text-foreground"
						size="sm"
						variant="ghost"
					>
						<NavLink href={`/restaurant/${currentRestaurant}/members`}>
							Members
						</NavLink>
					</Button>
				)}

				{(canUpdateRestaurant || canGetBillingDetails) && (
					<Button
						asChild
						className="border border-transparent text-muted-foreground data-[current=true]:border-border data-[current=true]:text-foreground"
						size="sm"
						variant="ghost"
					>
						<NavLink href={`/restaurant/${currentRestaurant}/settings`}>
							Settings & Billing
						</NavLink>
					</Button>
				)}
			</nav>
		</div>
	);
}
