"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StockQuantity } from "@/lib/stock";

interface StockFieldProps {
	defaultMinValue?: number | null;
	defaultValue?: StockQuantity;
	errors?: {
		minStockQuantity?: string[];
		stockQuantity?: string[];
	} | null;
}

/**
 * Units on hand (empty = the product does not track stock) and the low-stock
 * minimum, which only applies when stock is tracked.
 */
export function StockField({
	defaultValue = null,
	defaultMinValue = null,
	errors,
}: StockFieldProps) {
	const [stock, setStock] = useState(defaultValue?.toString() ?? "");
	const isTracked = stock.trim() !== "";

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<div className="space-y-3">
				<Label htmlFor="stockQuantity">
					Estoque (unidades){" "}
					<span className="text-muted-foreground text-xs">(opcional)</span>
				</Label>

				<Input
					aria-describedby="stockQuantity-hint"
					id="stockQuantity"
					inputMode="numeric"
					min={0}
					name="stockQuantity"
					onChange={(event) => setStock(event.target.value)}
					placeholder="Ex.: 24"
					step={1}
					type="number"
					value={stock}
				/>

				{errors?.stockQuantity && (
					<p className="font-medium text-destructive text-xs">
						{errors.stockQuantity[0]}
					</p>
				)}
			</div>

			<div className="space-y-3">
				<Label htmlFor="minStockQuantity">
					Estoque mínimo{" "}
					<span className="text-muted-foreground text-xs">(opcional)</span>
				</Label>

				{/* Disabled inputs are not submitted: no stock, no minimum. */}
				<Input
					aria-describedby="stockQuantity-hint"
					defaultValue={defaultMinValue ?? ""}
					disabled={!isTracked}
					id="minStockQuantity"
					inputMode="numeric"
					min={0}
					name="minStockQuantity"
					placeholder={isTracked ? "Ex.: 6" : "Informe o estoque"}
					step={1}
					type="number"
				/>

				{errors?.minStockQuantity && (
					<p className="font-medium text-destructive text-xs">
						{errors.minStockQuantity[0]}
					</p>
				)}
			</div>

			<p
				className="text-muted-foreground text-xs sm:col-span-2"
				id="stockQuantity-hint"
			>
				O estoque é baixado a cada venda, no fechamento da comanda. Deixe vazio
				para não controlar (ex.: pratos feitos na hora). Com estoque mínimo, o
				produto gera alerta amarelo ao chegar nele e vermelho ao esgotar.
			</p>
		</div>
	);
}
