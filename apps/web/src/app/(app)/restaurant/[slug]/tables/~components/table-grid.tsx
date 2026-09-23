import type { TableStatus } from "@/api/http/services/get-tables";
import { getTables } from "@/api/http/services/get-tables";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentRestaurant } from "@/providers/auth-provider";

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

export async function TableGrid() {
	const currentRestaurant = await getCurrentRestaurant();

	// biome-ignore lint/style/noNonNullAssertion: always come as string
	const { tables } = await getTables(currentRestaurant!);

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

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
				{tables.map((table) => {
					const status = STATUS_CONFIG[table.status];

					return (
						<Card key={table.id}>
							<CardHeader className="flex-row items-start justify-between">
								<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
									Mesa
								</span>

								<span className={`size-2.5 rounded-full ${status.dot}`} />
							</CardHeader>

							<CardContent className="space-y-1">
								<p className="font-semibold text-3xl">{table.number}</p>

								<p className="text-muted-foreground text-sm">
									{table.seatsCount}{" "}
									{table.seatsCount === 1 ? "lugar" : "lugares"}
								</p>

								<p className={`font-medium text-sm ${status.text}`}>
									{status.label}
								</p>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
