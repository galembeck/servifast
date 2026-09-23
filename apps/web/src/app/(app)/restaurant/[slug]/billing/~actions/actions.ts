"use server";

import { HTTPError } from "ky";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createExpense } from "@/api/http/services/create-expense";
import { getCurrentRestaurant } from "@/providers/auth-provider";

const createExpenseSchema = z.object({
	amount: z.coerce
		.number({ error: "Informe um valor válido" })
		.positive({ message: "O valor deve ser maior que zero" }),
	category: z.string().min(1, { message: "Selecione uma categoria" }),
	customCategory: z.string().optional(),
	date: z.string().min(1, { message: "Informe a data" }),
});

export async function createExpenseAction(data: FormData) {
	const result = createExpenseSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;

		return { success: false, title: null, description: null, errors };
	}

	const { category, customCategory, amount, date } = result.data;

	const finalCategory =
		category === "Outros" && customCategory?.trim()
			? customCategory.trim()
			: category;

	const currentRestaurant = await getCurrentRestaurant();

	try {
		await createExpense({
			// biome-ignore lint/style/noNonNullAssertion: always come as string
			restaurant: currentRestaurant!,
			category: finalCategory,
			amount,
			date,
		});

		revalidateTag(`${currentRestaurant}/expenses`, "max");
	} catch (error) {
		if (error instanceof HTTPError) {
			const { title, description } = error.data as {
				description: string | null;
				title: string | null;
			};

			return { success: false, title, description, errors: null };
		}

		return {
			success: false,
			title: "Erro inesperado",
			description: "Tente novamente em alguns instantes.",
			errors: null,
		};
	}

	return {
		success: true,
		title: "Despesa registrada!",
		description: "A despesa foi registrada com sucesso.",
		errors: null,
	};
}
