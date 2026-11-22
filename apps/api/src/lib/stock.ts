import { z } from "zod";
import { MenuException } from "@/http/_errors/exceptions/menu";
import { TabException } from "@/http/_errors/exceptions/tab";
import { BadRequestError } from "@/http/routes/_errors/bad-request-error";
import { ConflictError } from "@/http/routes/_errors/conflict-error";

/**
 * Multipart field for a menu item's stock (or its minimum). An empty value
 * means null (stock not tracked / no alert); a missing field is left
 * undefined so updates keep the current value.
 */
export const stockQuantityFieldSchema = z
	.string()
	.optional()
	.transform((value, ctx): number | null | undefined => {
		if (value === undefined) {
			return;
		}

		const trimmed = value.trim();

		if (trimmed === "") {
			return null;
		}

		const quantity = Number(trimmed);

		if (!Number.isInteger(quantity) || quantity < 0) {
			ctx.addIssue({
				code: "custom",
				message: "Must be a whole number greater than or equal to 0.",
			});
			return z.NEVER;
		}

		return quantity;
	});

interface StockSettings {
	minStockQuantity: number | null;
	stockQuantity: number | null;
}

/**
 * Final stock/minimum of a menu item after a create or update. Missing fields
 * keep the current value; stopping stock tracking also clears the minimum.
 * A minimum on an item that does not track stock is not allowed (RN01 needs a
 * balance to compare): 400 MIN_STOCK_REQUIRES_TRACKING, nothing is written.
 */
export function resolveStockSettings(
	input: {
		minStockQuantity: number | null | undefined;
		stockQuantity: number | null | undefined;
	},
	current: StockSettings = { stockQuantity: null, minStockQuantity: null }
): StockSettings {
	const stockQuantity =
		input.stockQuantity === undefined
			? current.stockQuantity
			: input.stockQuantity;

	let minStockQuantity = input.minStockQuantity;

	if (minStockQuantity === undefined) {
		minStockQuantity = stockQuantity === null ? null : current.minStockQuantity;
	}

	if (minStockQuantity !== null && stockQuantity === null) {
		throw new BadRequestError(
			"Minimum stock requires stock tracking.",
			MenuException.MIN_STOCK_REQUIRES_TRACKING,
			"Set the item's stock before setting a minimum stock."
		);
	}

	return { stockQuantity, minStockQuantity };
}

/**
 * Stock fields to write when updating a menu item. A missing balance is not
 * written, so an edit never overwrites a balance decremented concurrently by
 * a tab close; the minimum is written when sent or cleared with the stock.
 */
export function buildStockUpdate(
	input: {
		minStockQuantity: number | null | undefined;
		stockQuantity: number | null | undefined;
	},
	current: {
		minStockQuantity?: number | null;
		stockQuantity?: number | null;
	}
) {
	const { minStockQuantity } = resolveStockSettings(input, {
		stockQuantity: current.stockQuantity ?? null,
		minStockQuantity: current.minStockQuantity ?? null,
	});
	const shouldWriteMinStock =
		input.minStockQuantity !== undefined || input.stockQuantity === null;

	return {
		...(input.stockQuantity === undefined
			? {}
			: { stockQuantity: input.stockQuantity }),
		...(shouldWriteMinStock ? { minStockQuantity } : {}),
	};
}

interface SoldItem {
	menuItemId: string;
	quantity: number;
}

/** Units sold per menu item: the 1:1 rule (RN02), one unit per unit sold. */
export function sumQuantitiesByMenuItem(items: SoldItem[]) {
	const quantities = new Map<string, number>();

	for (const { menuItemId, quantity } of items) {
		quantities.set(menuItemId, (quantities.get(menuItemId) ?? 0) + quantity);
	}

	return quantities;
}

interface StockShortage {
	missing: number;
	name: string;
}

/** "Chopp ×1, Suco ×2": language-neutral so the web can embed it in its copy. */
export function formatStockShortages(shortages: StockShortage[]) {
	return shortages.map(({ name, missing }) => `${name} ×${missing}`).join(", ");
}

/**
 * Decrements the stock of every tracked product sold in a tab (RN01: runs
 * inside the tab-closing transaction). Untracked products (null stock) are
 * skipped. Each decrement is conditional (`stock >= quantity`), so a product
 * without enough units throws 409 INSUFFICIENT_STOCK and the caller's
 * transaction rolls back: no payment, no closed tab, no partial decrement.
 */
export async function decrementStockForSale(
	// biome-ignore lint/suspicious/noExplicitAny: tx type requires generated Prisma client (run db:generate)
	tx: any,
	items: SoldItem[]
) {
	const quantities = sumQuantitiesByMenuItem(items);

	if (quantities.size === 0) {
		return;
	}

	const trackedItems: {
		id: string;
		name: string;
		stockQuantity: number;
	}[] = await tx.menuItem.findMany({
		where: { id: { in: [...quantities.keys()] }, stockQuantity: { not: null } },
		select: { id: true, name: true, stockQuantity: true },
	});

	const shortages: StockShortage[] = [];

	for (const item of trackedItems) {
		const quantity = quantities.get(item.id) ?? 0;

		const result = await tx.menuItem.updateMany({
			where: { id: item.id, stockQuantity: { gte: quantity } },
			data: { stockQuantity: { decrement: quantity } },
		});

		if (result.count === 0) {
			shortages.push({
				name: item.name,
				missing: quantity - Math.max(item.stockQuantity, 0),
			});
		}
	}

	if (shortages.length > 0) {
		throw new ConflictError(
			"Not enough stock to close the tab.",
			TabException.INSUFFICIENT_STOCK,
			formatStockShortages(shortages)
		);
	}
}
