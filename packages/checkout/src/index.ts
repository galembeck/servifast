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
