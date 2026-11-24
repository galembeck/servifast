import {
	type CheckoutAdjustments,
	calculateCheckoutTotals,
	checkoutTotalError,
} from "@repo/checkout";
import { PaymentException } from "@/http/_errors/exceptions/payment";
import { BadRequestError } from "@/http/routes/_errors/bad-request-error";
import { UnprocessableEntityError } from "@/http/routes/_errors/unprocessable-entity-error";
export function calculatePayment(
	items: { quantity: number; unitPriceInCents: number }[],
	input: CheckoutAdjustments & { method: string; receivedInCents?: number }
) {
	const { method, receivedInCents, serviceFee, discount } = input;
	const subtotalInCents = items.reduce(
		(total, item) => total + item.quantity * item.unitPriceInCents,
		0
	);

	let totals: ReturnType<typeof calculateCheckoutTotals>;
	try {
		totals = calculateCheckoutTotals(subtotalInCents, {
			serviceFee,
			discount,
		});
		const error = checkoutTotalError(totals.amountInCents);
		if (error) {
			throw new RangeError(error);
		}
	} catch (error) {
		throw new UnprocessableEntityError(
			"Ajustes inválidos",
			PaymentException.INVALID_CHECKOUT_ADJUSTMENTS,
			error instanceof RangeError
				? error.message
				: "Confira a taxa e o desconto."
		);
	}
	const { amountInCents } = totals;
	const isCash = method === "CASH";

	if (isCash && receivedInCents === undefined) {
		throw new BadRequestError(
			"Received amount is required.",
			PaymentException.CASH_RECEIVED_AMOUNT_REQUIRED,
			"Cash payments must inform the amount received from the customer."
		);
	}

	if (isCash && (receivedInCents ?? 0) < amountInCents) {
		throw new UnprocessableEntityError(
			"Insufficient cash amount.",
			PaymentException.INSUFFICIENT_CASH_AMOUNT,
			`The amount received does not cover the total of ${amountInCents} cents.`
		);
	}

	const cashReceived = isCash ? (receivedInCents ?? null) : null;
	const changeInCents =
		cashReceived === null ? null : cashReceived - amountInCents;

	return { totals, cashReceived, changeInCents };
}
