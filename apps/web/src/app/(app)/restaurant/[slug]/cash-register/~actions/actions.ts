"use server";

import { HTTPError } from "ky";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
	type CashRegisterClosing,
	closeCashRegister,
} from "@/api/http/services/close-cash-register";
import { createCashRegisterTransaction } from "@/api/http/services/create-cash-register-transaction";
import { openCashRegister } from "@/api/http/services/open-cash-register";
import { getCurrentRestaurant } from "@/providers/auth-provider";

const CENTS_PER_REAL = 100;
const DESCRIPTION_MAX_LENGTH = 200;

/** API error codes (`message`) translated for the cash register screen. */
const CASH_REGISTER_ERROR_MESSAGES: Record<string, string> = {
	CASH_REGISTER_ALREADY_OPEN: "O caixa já está aberto.",
	CASH_REGISTER_NOT_OPEN: "O caixa não está aberto.",
	INSUFFICIENT_CASH_BALANCE:
		"Saldo insuficiente: a sangria é maior que o dinheiro em caixa.",
	FORBIDDEN: "Você não tem permissão para operar o caixa.",
};

/** CurrencyInput submits reais as "12.34"; the API works in cents. */
const amountInReais = z.coerce
	.number({ error: "Informe um valor válido" })
	.nonnegative({ message: "O valor não pode ser negativo" })
	.transform((amount) => Math.round(amount * CENTS_PER_REAL));

const openCashRegisterSchema = z.object({
	openingAmount: amountInReais,
});

const cashMovementSchema = z.object({
	type: z.enum(["SUPPLY", "WITHDRAWAL"]),
	amount: amountInReais.refine((cents) => cents > 0, {
		message: "O valor deve ser maior que zero",
	}),
	description: z
		.string()
		.trim()
		.max(DESCRIPTION_MAX_LENGTH, {
			message: `Use no máximo ${DESCRIPTION_MAX_LENGTH} caracteres`,
		})
		.optional(),
});

const closeCashRegisterSchema = z.object({
	countedAmount: amountInReais,
});

async function requireCurrentRestaurant() {
	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	return (await getCurrentRestaurant())!;
}

function toErrorState(error: unknown, fallbackTitle: string) {
	if (error instanceof HTTPError) {
		const data = (error.data ?? {}) as {
			description?: string | null;
			message?: string;
			title?: string | null;
		};

		return {
			success: false,
			title:
				(data.message && CASH_REGISTER_ERROR_MESSAGES[data.message]) ||
				data.title ||
				fallbackTitle,
			description: null,
			errors: null,
		};
	}

	return {
		success: false,
		title: "Erro inesperado",
		description: "Tente novamente em alguns instantes.",
		errors: null,
	};
}

export async function openCashRegisterAction(data: FormData) {
	const result = openCashRegisterSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;
		return { success: false, title: null, description: null, errors };
	}

	const currentRestaurant = await requireCurrentRestaurant();

	try {
		await openCashRegister({
			restaurant: currentRestaurant,
			openingAmountInCents: result.data.openingAmount,
		});
	} catch (error) {
		revalidateTag(`${currentRestaurant}/cash-register`, "max");
		return toErrorState(error, "Erro ao abrir o caixa.");
	}

	revalidateTag(`${currentRestaurant}/cash-register`, "max");

	return {
		success: true,
		title: "Caixa aberto!",
		description: null,
		errors: null,
	};
}

export async function createCashMovementAction(data: FormData) {
	const result = cashMovementSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;
		return { success: false, title: null, description: null, errors };
	}

	const { type, amount, description } = result.data;
	const currentRestaurant = await requireCurrentRestaurant();

	try {
		await createCashRegisterTransaction({
			restaurant: currentRestaurant,
			type,
			amountInCents: amount,
			description: description || undefined,
		});
	} catch (error) {
		revalidateTag(`${currentRestaurant}/cash-register`, "max");
		return toErrorState(
			error,
			type === "SUPPLY"
				? "Erro ao registrar o suprimento."
				: "Erro ao registrar a sangria."
		);
	}

	revalidateTag(`${currentRestaurant}/cash-register`, "max");

	return {
		success: true,
		title: type === "SUPPLY" ? "Suprimento registrado!" : "Sangria registrada!",
		description: null,
		errors: null,
	};
}

type CloseCashRegisterResult =
	| { success: true; closing: CashRegisterClosing }
	| {
			success: false;
			title: string | null;
			errors: Record<string, string[] | undefined> | null;
	  };

/**
 * Closes the register with the blind count. It deliberately does NOT
 * revalidate the page: the dialog must stay mounted to show the
 * reconciliation, and `finishCashRegisterClosingAction` refreshes the screen
 * once the operator dismisses it.
 */
export async function closeCashRegisterAction(
	data: FormData
): Promise<CloseCashRegisterResult> {
	const result = closeCashRegisterSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;
		return { success: false, title: null, errors };
	}

	const currentRestaurant = await requireCurrentRestaurant();

	try {
		const { session } = await closeCashRegister({
			restaurant: currentRestaurant,
			countedAmountInCents: result.data.countedAmount,
		});

		return { success: true, closing: session };
	} catch (error) {
		const { title } = toErrorState(error, "Erro ao fechar o caixa.");
		return { success: false, title, errors: null };
	}
}

export async function finishCashRegisterClosingAction() {
	const currentRestaurant = await requireCurrentRestaurant();

	revalidateTag(`${currentRestaurant}/cash-register`, "max");
}
