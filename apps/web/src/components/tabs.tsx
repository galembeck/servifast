import { ability, getCurrentRestaurant } from "@/providers/auth-provider";
import { NavLink } from "./nav-link";
import { Button } from "./ui/button";

export async function Tabs() {
	const currentRestaurant = await getCurrentRestaurant();

	const permissions = await ability();

	const canGetMembers = permissions?.can("get", "User");
	const canGetMenu = permissions?.can("get", "Menu");
	const canGetTables = permissions?.can("get", "Table");

	const canUpdateRestaurant = permissions?.can("update", "Restaurant");
	const canGetBillingDetails = permissions?.can("get", "Billing");

	return (
		<div className="border-b py-4">
			<nav className="mx-auto flex max-w-300 items-center gap-2">
				{canGetMenu && (
					<Button
						asChild
						className="border border-transparent text-muted-foreground data-[current=true]:border-border data-[current=true]:text-foreground"
						size="sm"
						variant="ghost"
					>
						<NavLink href={`/restaurant/${currentRestaurant}`}>
							Cardápio (Menu Digital)
						</NavLink>
					</Button>
				)}

				{canGetTables && (
					<Button
						asChild
						className="border border-transparent text-muted-foreground data-[current=true]:border-border data-[current=true]:text-foreground"
						size="sm"
						variant="ghost"
					>
						<NavLink href={`/restaurant/${currentRestaurant}/tables`}>
							Mesas
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
							Funcionários
						</NavLink>
					</Button>
				)}

				{canGetBillingDetails && (
					<Button
						asChild
						className="border border-transparent text-muted-foreground data-[current=true]:border-border data-[current=true]:text-foreground"
						size="sm"
						variant="ghost"
					>
						<NavLink href={`/restaurant/${currentRestaurant}/billing`}>
							Financeiro
						</NavLink>
					</Button>
				)}

				{canUpdateRestaurant && (
					<Button
						asChild
						className="border border-transparent text-muted-foreground data-[current=true]:border-border data-[current=true]:text-foreground"
						size="sm"
						variant="ghost"
					>
						<NavLink href={`/restaurant/${currentRestaurant}/settings`}>
							Configurações
						</NavLink>
					</Button>
				)}
			</nav>
		</div>
	);
}
