export interface BillableItem {
	menuItem: { id: string; name: string };
	quantity: number;
	unitPriceInCents: number;
}

export interface BillLine {
	menuItemId: string;
	name: string;
	quantity: number;
	totalInCents: number;
	unitPriceInCents: number;
}

/**
 * Groups equal items sold at the same unit price into a single bill line
 * (2× + 1× Pizza → 3× Pizza), keeping the order of first appearance, and sums
 * the subtotal. Callers decide which items are billable before calling it.
 */
export function groupBillItems(items: BillableItem[]) {
	const lines = new Map<string, BillLine>();

	for (const item of items) {
		const key = `${item.menuItem.id}:${item.unitPriceInCents}`;
		const line = lines.get(key);
		const itemTotal = item.quantity * item.unitPriceInCents;

		if (line) {
			line.quantity += item.quantity;
			line.totalInCents += itemTotal;
		} else {
			lines.set(key, {
				menuItemId: item.menuItem.id,
				name: item.menuItem.name,
				quantity: item.quantity,
				unitPriceInCents: item.unitPriceInCents,
				totalInCents: itemTotal,
			});
		}
	}

	const billLines = [...lines.values()];
	const subtotalInCents = billLines.reduce(
		(total, line) => total + line.totalInCents,
		0
	);

	return { lines: billLines, subtotalInCents };
}
