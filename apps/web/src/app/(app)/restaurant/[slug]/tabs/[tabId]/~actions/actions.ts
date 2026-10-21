"use server";

import { HTTPError } from "ky";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { addTabItem } from "@/api/http/services/add-tab-item";
import { cancelTabItem } from "@/api/http/services/cancel-tab-item";
import { sendToKitchen } from "@/api/http/services/send-to-kitchen";
import { getCurrentRestaurant } from "@/providers/auth-provider";

const addTabItemSchema = z.object({
	tabId: z.string().uuid(),
	menuItemId: z.string().uuid(),
	quantity: z.coerce
		.number()
		.int()
		.min(1, { message: "A quantidade deve ser pelo menos 1." }),
	notes: z.string().max(500).optional(),
});

export async function addTabItemAction(data: FormData) {
	const result = addTabItemSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;
		return { success: false, title: null, description: null, errors };
	}

	const { tabId, menuItemId, quantity, notes } = result.data;

	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	try {
		await addTabItem({
			restaurant: currentRestaurant,
			tabId,
			menuItemId,
			quantity,
			notes: notes || undefined,
		});
	} catch (error) {
		if (error instanceof HTTPError) {
			const { title, description } = (await error.response.json()) as {
				title: string | null;
				description: string | null;
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

	revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "layout");

	return {
		success: true,
		title: "Item adicionado!",
		description: "O item foi adicionado à comanda.",
		errors: null,
	};
}

export async function cancelTabItemAction(tabId: string, itemId: string) {
	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	try {
		await cancelTabItem({ restaurant: currentRestaurant, tabId, itemId });
	} catch (error) {
		if (error instanceof HTTPError) {
			const { title, description } = (await error.response.json()) as {
				title: string | null;
				description: string | null;
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

	revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "layout");

	return {
		success: true,
		title: "Item cancelado.",
		description: null,
		errors: null,
	};
}

export async function sendToKitchenAction(tabId: string) {
	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	try {
		await sendToKitchen({ restaurant: currentRestaurant, tabId });
	} catch (error) {
		if (error instanceof HTTPError) {
			const { title, description } = (await error.response.json()) as {
				title: string | null;
				description: string | null;
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

	revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "layout");

	return {
		success: true,
		title: "Pedido enviado para a cozinha!",
		description: null,
		errors: null,
	};
}
