import { getTables } from "@/api/http/services/get-tables";
import { getCurrentRestaurant } from "@/providers/auth-provider";
import { TableGridClient } from "./table-grid-client";

interface TableGridProps {
	canOpenTab: boolean;
	slug: string;
	tableClickOpensBill: boolean;
}

export async function TableGrid({
	canOpenTab,
	slug,
	tableClickOpensBill,
}: TableGridProps) {
	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	const { tables } = await getTables(currentRestaurant);

	return (
		<TableGridClient
			canOpenTab={canOpenTab}
			currentRestaurant={currentRestaurant}
			slug={slug}
			tableClickOpensBill={tableClickOpensBill}
			tables={tables}
		/>
	);
}
