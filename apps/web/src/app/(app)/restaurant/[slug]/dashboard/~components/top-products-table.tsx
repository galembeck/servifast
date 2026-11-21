import { ArrowDownRight, ArrowUpRight, Trophy } from "lucide-react";
import type { TopProduct } from "@/api/http/services/get-top-products";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatInteger, formatPercentChange, formatPrice } from "./format";

const PERCENT = new Intl.NumberFormat("pt-BR", {
	style: "percent",
	maximumFractionDigits: 1,
});

/** How the average ticket of services with this product compares overall. */
function TicketComparison({
	overallInCents,
	withItemInCents,
}: {
	overallInCents: number;
	withItemInCents: number;
}) {
	if (overallInCents === 0 || withItemInCents === overallInCents) {
		return null;
	}

	const ratio = withItemInCents / overallInCents - 1;
	const isAbove = ratio > 0;
	const Icon = isAbove ? ArrowUpRight : ArrowDownRight;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-0.5 font-medium text-xs",
				isAbove ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
			)}
			title={`${isAbove ? "Acima" : "Abaixo"} do ticket médio geral`}
		>
			<Icon aria-hidden className="size-3" />
			{formatPercentChange(ratio)}
			<span className="sr-only">
				{isAbove ? "acima" : "abaixo"} do ticket médio geral
			</span>
		</span>
	);
}

interface TopProductsTableProps {
	overallAverageTicketInCents: number;
	products: TopProduct[];
	totalUnits: number;
}

export function TopProductsTable({
	overallAverageTicketInCents,
	products,
	totalUnits,
}: TopProductsTableProps) {
	const topQuantity = products[0]?.quantity ?? 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Trophy aria-hidden className="size-4 text-muted-foreground" />
					Top 10 produtos mais vendidos
				</CardTitle>
				<CardDescription>
					Por quantidade vendida em atendimentos concluídos
					{totalUnits > 0 &&
						` · ${formatInteger(totalUnits)} unidades no período`}
				</CardDescription>
			</CardHeader>

			<CardContent>
				{products.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						Nenhum produto vendido no período.
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-10 text-center">#</TableHead>
								<TableHead>Produto</TableHead>
								<TableHead className="min-w-40">Quantidade</TableHead>
								<TableHead className="text-right">% das unidades</TableHead>
								<TableHead className="text-right">Faturamento</TableHead>
								<TableHead className="text-right">Atendimentos</TableHead>
								<TableHead className="text-right">
									<abbr
										className="no-underline"
										title="Ticket médio dos atendimentos em que o produto foi pedido"
									>
										Ticket c/ produto
									</abbr>
								</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody className="tabular-nums">
							{products.map((product) => (
								<TableRow key={product.menuItemId}>
									<TableCell className="text-center font-medium text-muted-foreground">
										{product.rank}
									</TableCell>
									<TableCell>
										<p className="font-medium">{product.name}</p>
										{product.categoryName && (
											<p className="text-muted-foreground text-xs">
												{product.categoryName}
											</p>
										)}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-3">
											<span className="w-8 text-right font-medium">
												{formatInteger(product.quantity)}
											</span>
											{/* Bar relative to the #1 product; 4px rounded ends. */}
											<div
												aria-hidden
												className="h-1.5 flex-1 rounded-full bg-muted"
											>
												<div
													className="h-full rounded-full bg-chart-sales"
													style={{
														width: `${topQuantity === 0 ? 0 : (product.quantity / topQuantity) * 100}%`,
													}}
												/>
											</div>
										</div>
									</TableCell>
									<TableCell className="text-right text-muted-foreground">
										{PERCENT.format(product.unitsShare)}
									</TableCell>
									<TableCell className="text-right">
										{formatPrice(product.revenueInCents)}
									</TableCell>
									<TableCell className="text-right text-muted-foreground">
										{formatInteger(product.servicesCount)}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex flex-col items-end">
											<span>
												{formatPrice(product.averageTicketWithItemInCents)}
											</span>
											<TicketComparison
												overallInCents={overallAverageTicketInCents}
												withItemInCents={product.averageTicketWithItemInCents}
											/>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
