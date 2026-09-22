import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { getRestaurants } from "@/api/http/services/get-restaurants";
import { getCurrentRestaurant } from "@/providers/auth-provider";
import { RestaurantSwitchTrigger } from "./restaurant-switch-trigger";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "./ui/dropdown-menu";

export async function RestaurantSwitch() {
	const currentRestaurantSlug = await getCurrentRestaurant();

	const { restaurants } = await getRestaurants();

	const currentRestaurant = restaurants.find(
		(restaurant) => restaurant.slug === currentRestaurantSlug
	);

	return (
		<DropdownMenu>
			<RestaurantSwitchTrigger currentRestaurant={currentRestaurant} />

			<DropdownMenuContent
				align="end"
				alignOffset={-16}
				className="w-50"
				sideOffset={12}
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel>Restaurantes</DropdownMenuLabel>

					{restaurants.map((restaurant) => (
						<DropdownMenuItem asChild key={restaurant.id}>
							<Link href={`/restaurant/${restaurant.slug}`}>
								<Avatar className="mr-1 size-5">
									{restaurant.avatarUrl && (
										<AvatarImage
											className="size-auto"
											src={restaurant.avatarUrl}
										/>
									)}
									<AvatarFallback />
								</Avatar>

								<span className="line-clamp-1">{restaurant.name}</span>
							</Link>
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>

				<DropdownMenuSeparator />

				<DropdownMenuItem asChild>
					<Link href="/create-restaurant">
						<PlusCircle className="mr-1 size-5" />
						Registrar restaurante
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
