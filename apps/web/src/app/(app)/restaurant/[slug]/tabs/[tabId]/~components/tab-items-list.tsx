import type { TabItem } from "@/api/http/services/get-tab";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_LABEL: Record<TabItem["status"], string> = {
	RECEIVED: "Recebido",
};

const STATUS_VARIANT: Record<
	TabItem["status"],
	"default" | "secondary" | "outline"
> = {
	RECEIVED: "secondary",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

function formatPrice(priceInCents: number) {
	return currencyFormatter.format(priceInCents / 100);
}

interface TabItemsListProps {
	items: TabItem[];
}

export function TabItemsList({ items }: TabItemsListProps) {
	if (items.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Nenhum item adicionado ainda.
			</p>
		);
	}

	return (
		<div className="space-y-2">
			{items.map((item) => (
				<Card key={item.id}>
					<CardContent className="flex items-start justify-between gap-4 py-3">
						<div className="space-y-0.5">
							<p className="font-medium text-sm">{item.menuItem.name}</p>
							{item.notes && (
								<p className="text-muted-foreground text-xs">{item.notes}</p>
							)}
						</div>

						<div className="flex shrink-0 flex-col items-end gap-1">
							<p className="font-medium text-sm">
								{item.quantity}× {formatPrice(item.unitPriceInCents)}
							</p>
							<Badge variant={STATUS_VARIANT[item.status]}>
								{STATUS_LABEL[item.status]}
							</Badge>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
