import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StockQuantity } from "@/lib/stock";

interface StockFieldProps {
	defaultValue?: StockQuantity;
	error?: string;
}

/** Units on hand. Empty = the product does not track stock. */
export function StockField({ defaultValue = null, error }: StockFieldProps) {
	return (
		<div className="space-y-3">
			<Label htmlFor="stockQuantity">
				Estoque (unidades){" "}
				<span className="text-muted-foreground text-xs">(opcional)</span>
			</Label>

			<Input
				aria-describedby="stockQuantity-hint"
				defaultValue={defaultValue ?? ""}
				id="stockQuantity"
				inputMode="numeric"
				min={0}
				name="stockQuantity"
				placeholder="Ex.: 24"
				step={1}
				type="number"
			/>

			<p className="text-muted-foreground text-xs" id="stockQuantity-hint">
				Baixado automaticamente a cada venda, no fechamento da comanda. Deixe
				vazio para não controlar o estoque (ex.: pratos feitos na hora).
			</p>

			{error && <p className="font-medium text-destructive text-xs">{error}</p>}
		</div>
	);
}
