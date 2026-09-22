"use client";

import { ChevronsUpDown, PlusCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { DropdownMenuTrigger } from "./ui/dropdown-menu";

interface Restaurant {
	avatarUrl: string | null;
	name: string;
}

interface RestaurantSwitchTriggerProps {
	currentRestaurant: Restaurant | undefined;
}

function TriggerLabel({
	currentRestaurant,
	isCreatingRestaurant,
}: {
	currentRestaurant: Restaurant | undefined;
	isCreatingRestaurant: boolean;
}) {
	if (isCreatingRestaurant) {
		return (
			<>
				<PlusCircle className="mr-1 size-5 text-muted-foreground" />
				<span className="truncate text-left">Registrar restaurante</span>
			</>
		);
	}

	if (currentRestaurant) {
		return (
			<>
				<Avatar className="size-5">
					{currentRestaurant.avatarUrl && (
						<AvatarImage
							className="size-auto"
							src={currentRestaurant.avatarUrl}
						/>
					)}
					<AvatarFallback />
				</Avatar>

				<span className="truncate text-left">{currentRestaurant.name}</span>
			</>
		);
	}

	return <span className="text-muted-foreground">Selecionar restaurante</span>;
}

export function RestaurantSwitchTrigger({
	currentRestaurant,
}: RestaurantSwitchTriggerProps) {
	const pathname = usePathname();

	const isCreatingRestaurant = pathname === "/create-restaurant";

	return (
		<DropdownMenuTrigger className="flex w-50 cursor-pointer items-center gap-2 rounded p-1 font-medium text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary">
			<TriggerLabel
				currentRestaurant={currentRestaurant}
				isCreatingRestaurant={isCreatingRestaurant}
			/>

			<ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
		</DropdownMenuTrigger>
	);
}
