/** Units on hand; `null` means the product does not track stock. */
export type StockQuantity = number | null;

export function isOutOfStock(stockQuantity: StockQuantity) {
	return stockQuantity !== null && stockQuantity <= 0;
}

/** "12 un. em estoque" / "Esgotado" / "Sem controle de estoque". */
export function formatStock(stockQuantity: StockQuantity) {
	if (stockQuantity === null) {
		return "Sem controle de estoque";
	}

	if (stockQuantity <= 0) {
		return "Esgotado";
	}

	return `${stockQuantity} un. em estoque`;
}

export type StockAlertLevel = "CRITICAL" | "LOW";

/**
 * Same rule as the API (RN01): only items with stock and a minimum alert.
 * Sold out = CRITICAL (red); 0 < stock <= minimum = LOW (yellow).
 */
export function getStockAlertLevel(
	stockQuantity: StockQuantity,
	minStockQuantity: number | null
): StockAlertLevel | null {
	if (stockQuantity === null || minStockQuantity === null) {
		return null;
	}

	if (stockQuantity <= 0) {
		return "CRITICAL";
	}

	return stockQuantity <= minStockQuantity ? "LOW" : null;
}
