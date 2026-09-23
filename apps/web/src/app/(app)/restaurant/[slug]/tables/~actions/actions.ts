"use server";

import { HTTPError } from "ky";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createTable } from "@/api/http/services/create-table";
import { getCurrentRestaurant } from "@/providers/auth-provider";

const createTableSchema = z.object({
	number: z.coerce.number().int().positive({
		message: "O número da mesa deve ser um número positivo",
	}),
	positionReference: z.string().optional(),
	seatsCount: z.coerce.number().int().positive({
		message: "A quantidade de lugares deve ser um número positivo",
	}),
	observations: z.string().optional(),
});

export async function createTableAction(data: FormData) {
	const result = createTableSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;

		return { success: false, title: null, description: null, errors };
	}

	const { number, positionReference, seatsCount, observations } = result.data;

	const currentRestaurant = await getCurrentRestaurant();

	try {
		await createTable({
			// biome-ignore lint/style/noNonNullAssertion: always come as string
			restaurant: currentRestaurant!,
			number,
			positionReference: positionReference || null,
			seatsCount,
			observations: observations || null,
		});

		revalidateTag(`${currentRestaurant}/tables`, "max");
	} catch (error) {
		if (error instanceof HTTPError) {
			const { title, description } = error.data as {
				title: string | null;
				description: string | null;
			};

			return {
				success: false,
				title,
				description,
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

	return {
		success: true,
		title: "Mesa criada!",
		description: "A mesa foi criada com sucesso.",
		errors: null,
	};
}
