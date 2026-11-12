"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { getTableBill } from "@/api/http/services/get-table-bill";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { LIVE_QUERY_INTERVAL_IN_MS } from "@/hooks/use-live-query";

const CENTS_PER_REAL = 100;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
	hour: "2-digit",
	minute: "2-digit",
});

function formatPrice(priceInCents: number) {
	return currencyFormatter.format(priceInCents / CENTS_PER_REAL);
}

function pluralize(count: number, singular: string, plural: string) {
	return `${count} ${count === 1 ? singular : plural}`;
}

interface BillDialogProps {
	/** Extra actions rendered in the footer (e.g. a link to the tab). */
	actions?: ReactNode;
	currentRestaurant: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	tableId: string;
	tableNumber: number;
}

/**
 * Read-only bill of a table's open tab, for checking consumption before
 * payment. Refreshes while open so it reflects items confirmed or cancelled
 * by other staff.
 */
export function BillDialog({
	actions,
	currentRestaurant,
	onOpenChange,
	open,
	tableId,
	tableNumber,
}: BillDialogProps) {
	const {
		data: bill,
		isPending,
		isError,
	} = useQuery({
		queryKey: ["restaurants", currentRestaurant, "tables", tableId, "bill"],
		queryFn: () => getTableBill(currentRestaurant, tableId),
		enabled: open,
		refetchInterval: open ? LIVE_QUERY_INTERVAL_IN_MS : false,
		refetchIntervalInBackground: false,
		retry: false,
	});

	const excludedNotes = [
		bill?.cancelledItemsCount
			? pluralize(
					bill.cancelledItemsCount,
					"item cancelado",
					"itens cancelados"
				)
			: null,
		bill?.unconfirmedItemsCount
			? pluralize(
					bill.unconfirmedItemsCount,
					"item ainda não enviado à cozinha",
					"itens ainda não enviados à cozinha"
				)
			: null,
	].filter(Boolean);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Conta da mesa {tableNumber}</DialogTitle>
					<DialogDescription>
						{bill
							? [
									bill.tab.customerName,
									bill.tab.peopleCount
										? pluralize(bill.tab.peopleCount, "pessoa", "pessoas")
										: null,
									`aberta às ${timeFormatter.format(new Date(bill.tab.openedAt))}`,
								]
									.filter(Boolean)
									.join(" · ")
							: "Consumo da comanda aberta."}
					</DialogDescription>
				</DialogHeader>

				{isPending && (
					<div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
						<Loader2 className="mr-2 size-4 animate-spin" />
						Carregando conta...
					</div>
				)}

				{isError && !bill && (
					<p className="py-6 text-center text-muted-foreground text-sm">
						Não foi possível carregar a conta. A mesa pode ter sido liberada.
					</p>
				)}

				{bill && (
					<div className="space-y-3">
						{bill.items.length === 0 ? (
							<p className="py-6 text-center text-muted-foreground text-sm">
								Nenhum item confirmado nesta comanda ainda.
							</p>
						) : (
							<div className="max-h-[50vh] overflow-y-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-12">Qtd</TableHead>
											<TableHead>Item</TableHead>
											<TableHead className="text-right">Unitário</TableHead>
											<TableHead className="text-right">Total</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{bill.items.map((line) => (
											<TableRow
												key={`${line.menuItemId}:${line.unitPriceInCents}`}
											>
												<TableCell>{line.quantity}×</TableCell>
												<TableCell className="whitespace-normal">
													{line.name}
												</TableCell>
												<TableCell className="text-right text-muted-foreground">
													{formatPrice(line.unitPriceInCents)}
												</TableCell>
												<TableCell className="text-right font-medium">
													{formatPrice(line.totalInCents)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
									<TableFooter>
										<TableRow>
											<TableCell className="font-semibold" colSpan={3}>
												Subtotal
											</TableCell>
											<TableCell className="text-right font-semibold text-base">
												{formatPrice(bill.subtotalInCents)}
											</TableCell>
										</TableRow>
									</TableFooter>
								</Table>
							</div>
						)}

						{excludedNotes.length > 0 && (
							<p className="text-muted-foreground text-xs">
								Fora do subtotal: {excludedNotes.join(" e ")}.
							</p>
						)}
					</div>
				)}

				{actions && <DialogFooter>{actions}</DialogFooter>}
			</DialogContent>
		</Dialog>
	);
}
