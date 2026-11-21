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
