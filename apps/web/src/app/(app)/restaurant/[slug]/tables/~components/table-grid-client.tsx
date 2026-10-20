"use client";

import { useState } from "react";
import type { TableStatus } from "@/api/http/services/get-tables";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OpenTabDialog } from "./open-tab-dialog";

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

interface Table {
	id: string;
	number: number;
	seatsCount: number;
	status: TableStatus;
}

interface TableGridClientProps {
	canOpenTab: boolean;
	tables: Table[];
}

export function TableGridClient({ tables, canOpenTab }: TableGridClientProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedTable, setSelectedTable] = useState<Table | null>(null);

	function handleTableClick(table: Table) {
		if (!canOpenTab || table.status !== "FREE") {
			return;
		}
		setSelectedTable(table);
		setDialogOpen(true);
	}

	function handleDialogOpenChange(open: boolean) {
		setDialogOpen(open);
		if (!open) {
			setSelectedTable(null);
		}
	}

	return (
		<>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
				{tables.map((table) => {
					const status = STATUS_CONFIG[table.status];
					const isClickable = canOpenTab && table.status === "FREE";

					return (
						<Card
							className={
								isClickable
									? "cursor-pointer transition-shadow hover:shadow-md"
									: undefined
							}
							key={table.id}
							onClick={() => handleTableClick(table)}
							onKeyDown={
								isClickable
									? (e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												handleTableClick(table);
											}
										}
									: undefined
							}
							role={isClickable ? "button" : undefined}
							tabIndex={isClickable ? 0 : undefined}
						>
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

			{selectedTable && (
				<OpenTabDialog
					onOpenChange={handleDialogOpenChange}
					open={dialogOpen}
					tableId={selectedTable.id}
					tableNumber={selectedTable.number}
				/>
			)}
		</>
	);
}
