import type { TableStatus } from "@/api/http/services/get-tables";
import { getTables } from "@/api/http/services/get-tables";
import { getCurrentRestaurant } from "@/providers/auth-provider";
import { TableGridClient } from "./table-grid-client";

const STATUS_CONFIG: Record<
	TableStatus,
	{ dot: string; label: string; text: string }
> = {
	FREE: {
		dot: "bg-emerald-500",
		label: "Livre",
		text: "text-emerald-500",
	},
	OCCUPIED: {
		dot: "bg-blue-500",
		label: "Ocupada",
		text: "text-blue-500",
	},
	BILL_REQUESTED: {
		dot: "bg-amber-500",
		label: "Conta",
		text: "text-amber-500",
	},
};

function StatusLegend({ tables }: { tables: { status: TableStatus }[] }) {
	const counts: Record<TableStatus, number> = {
		FREE: 0,
		OCCUPIED: 0,
		BILL_REQUESTED: 0,
	};

	for (const table of tables) {
		counts[table.status] += 1;
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			{(Object.keys(STATUS_CONFIG) as TableStatus[]).map((status) => (
				<div
					className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
					key={status}
				>
					<span
						className={`size-2 rounded-full ${STATUS_CONFIG[status].dot}`}
					/>
					{counts[status]} {STATUS_CONFIG[status].label.toLowerCase()}
					{counts[status] === 1 ? "" : "s"}
				</div>
			))}
		</div>
	);
}

interface TableGridProps {
	canOpenTab: boolean;
	slug: string;
}

export async function TableGrid({ canOpenTab, slug }: TableGridProps) {
	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	const { tables } = await getTables(currentRestaurant);

	if (tables.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Nenhuma mesa cadastrada ainda.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<StatusLegend tables={tables} />

			<TableGridClient canOpenTab={canOpenTab} slug={slug} tables={tables} />
		</div>
	);
}
