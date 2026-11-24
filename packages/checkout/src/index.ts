/** Fixed amounts are cents; percentages are integer basis points (10% = 1000). */
export type CheckoutAdjustment =
	| { type: "FIXED"; amountInCents: number }
	| { type: "PERCENT"; basisPoints: number };
export interface CheckoutAdjustments {
	discount?: CheckoutAdjustment;
	serviceFee?: CheckoutAdjustment;
}
export const MAX_PAYMENT_IN_CENTS = 2_147_483_647;
const BASIS_POINTS_PER_WHOLE = 10_000;
function adjustmentInCents(
	subtotal: number,
	adjustment: CheckoutAdjustment | undefined
): number {
	if (!adjustment) {
		return 0;
	}
	if (adjustment.type === "FIXED") {
		if (
			!Number.isSafeInteger(adjustment.amountInCents) ||
			adjustment.amountInCents < 0 ||
			adjustment.amountInCents > MAX_PAYMENT_IN_CENTS
		) {
			throw new RangeError("Informe um valor em centavos válido.");
		}
		return adjustment.amountInCents;
	}
	if (
		adjustment.type !== "PERCENT" ||
		!Number.isSafeInteger(adjustment.basisPoints) ||
		adjustment.basisPoints < 0 ||
		adjustment.basisPoints > BASIS_POINTS_PER_WHOLE
	) {
		throw new RangeError(
			"Informe um percentual entre 0 e 100, com até duas casas decimais."
		);
	}
	// Both percentages use the original subtotal, independently. Integer math,
	// round half up to a cent; the bounded product remains a safe JS integer.
	return Math.floor(
		(subtotal * adjustment.basisPoints + BASIS_POINTS_PER_WHOLE / 2) /
			BASIS_POINTS_PER_WHOLE
	);
}
export function calculateCheckoutTotals(
	subtotalInCents: number,
	adjustments: CheckoutAdjustments = {}
) {
	if (
		!Number.isSafeInteger(subtotalInCents) ||
		subtotalInCents < 0 ||
		subtotalInCents > MAX_PAYMENT_IN_CENTS
	) {
		throw new RangeError("Subtotal fora do limite permitido.");
	}
	const serviceFeeInCents = adjustmentInCents(
		subtotalInCents,
		adjustments.serviceFee
	);
	const discountInCents = adjustmentInCents(
		subtotalInCents,
		adjustments.discount
	);
	const amountInCents = subtotalInCents + serviceFeeInCents - discountInCents;

	return { subtotalInCents, serviceFeeInCents, discountInCents, amountInCents };
}
/** Avoid binary floating point when reading a percent entered by the operator. */
const PERCENT_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;
export function parsePercentage(value: string): number | null {
	if (!PERCENT_PATTERN.test(value)) {
		return null;
	}
	const [whole = "0", fraction = ""] = value.replace(",", ".").split(".");
	const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
	return Number.isSafeInteger(basisPoints) && basisPoints <= 10_000
		? basisPoints
		: null;
}

export function checkoutTotalError(amountInCents: number): string | null {
	if (amountInCents < 0) {
		return "O desconto não pode deixar o total negativo.";
	}
	if (amountInCents > MAX_PAYMENT_IN_CENTS) {
		return "Total fora do limite permitido.";
	}
	return null;
}

export interface SplitItem {
	id: string;
	quantity: number;
	unitPriceInCents: number;
}
export interface SplitClient {
	items: { itemId: string; quantity: number }[];
	name: string;
}
export type BillSplitInput = CheckoutAdjustments &
	(
		| { mode: "PEOPLE"; people: number }
		| { mode: "ITEMS"; clients: SplitClient[] }
	);
/** Largest remainders, ties by input position; optional caps prevent negative shares. */
function apportion(amount: number, weights: number[], caps?: number[]) {
	const source = weights.some(Boolean) ? weights : weights.map(() => 1);
	const sum = source.reduce((a, b) => a + BigInt(b), BigInt(0));
	const parts = source.map((weight, index) => {
		const product = BigInt(amount) * BigInt(weight);
		return {
			index,
			remainder: product % sum,
			amount: Math.min(Number(product / sum), caps?.[index] ?? amount),
		};
	});
	let left = amount - parts.reduce((total, p) => total + p.amount, 0);
	const ranked = [...parts].sort(
		(a, b) => Number(b.remainder - a.remainder) || a.index - b.index
	);
	while (left > 0) {
		let changed = false;
		for (const part of ranked) {
			if (left > 0 && part.amount < (caps?.[part.index] ?? amount)) {
				part.amount++;
				left--;
				changed = true;
			}
		}
		if (!changed) {
			throw new RangeError("Não foi possível distribuir os centavos.");
		}
	}
	return parts.map((part) => part.amount);
}
export function splitCheckout(items: SplitItem[], input: BillSplitInput) {
	const subtotal = items.reduce(
		(sum, item) => sum + item.quantity * item.unitPriceInCents,
		0
	);
	const totals = calculateCheckoutTotals(subtotal, input);
	const error = checkoutTotalError(totals.amountInCents);
	if (error) {
		throw new RangeError(error);
	}
	if (input.mode === "PEOPLE") {
		if (
			!Number.isInteger(input.people) ||
			input.people < 2 ||
			input.people > 100
		) {
			throw new RangeError("Informe de 2 a 100 pessoas.");
		}
		return {
			totals,
			parts: apportion(
				totals.amountInCents,
				Array.from({ length: input.people }, () => 1)
			).map((amountInCents, index) => ({
				position: index + 1,
				name: `Pessoa ${index + 1}`,
				amountInCents,
				subtotalInCents: null,
				serviceFeeInCents: null,
				discountInCents: null,
				items: [] as SplitClient["items"],
			})),
		};
	}
	if (input.clients.length < 2 || input.clients.length > 100) {
		throw new RangeError("Informe de 2 a 100 clientes.");
	}
	const eligible = new Map(items.map((item) => [item.id, item]));
	const assigned = new Map<string, number>();
	const weights = input.clients.map((client) => {
		if (!client.name.trim() || client.items.length === 0) {
			throw new RangeError("Atribua itens a cada cliente.");
		}
		const seen = new Set<string>();
		return client.items.reduce((sum, allocation) => {
			const item = eligible.get(allocation.itemId);
			if (
				!item ||
				seen.has(item.id) ||
				!Number.isInteger(allocation.quantity) ||
				allocation.quantity <= 0
			) {
				throw new RangeError("Atribuição de itens inválida.");
			}
			seen.add(item.id);
			assigned.set(item.id, (assigned.get(item.id) ?? 0) + allocation.quantity);
			return sum + allocation.quantity * item.unitPriceInCents;
		}, 0);
	});
	for (const item of items) {
		if (assigned.get(item.id) !== item.quantity) {
			throw new RangeError(
				"Todas as unidades não canceladas devem ser atribuídas exatamente uma vez."
			);
		}
	}
	const fees = apportion(totals.serviceFeeInCents, weights);
	const discounts = apportion(
		totals.discountInCents,
		weights,
		weights.map((weight, i) => weight + (fees[i] ?? 0))
	);
	return {
		totals,
		parts: input.clients.map((client, i) => ({
			position: i + 1,
			name: client.name.trim(),
			subtotalInCents: weights[i] ?? 0,
			serviceFeeInCents: fees[i] ?? 0,
			discountInCents: discounts[i] ?? 0,
			amountInCents: (weights[i] ?? 0) + (fees[i] ?? 0) - (discounts[i] ?? 0),
			items: client.items,
		})),
	};
}
