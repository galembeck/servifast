"use server";

import { HTTPError } from "ky";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createMenuCategory } from "@/api/http/services/create-menu-category";
import { createMenuItem } from "@/api/http/services/create-menu-item";
import { deleteMenuItem } from "@/api/http/services/delete-menu-item";
import { updateMenuItem } from "@/api/http/services/update-menu-item";
import { getCurrentRestaurant } from "@/providers/auth-provider";

function extractErrorState(error: unknown) {
	if (error instanceof HTTPError) {
		const { title, description } = error.data as {
			description: string | null;
			title: string | null;
		};

		return { success: false as const, title, description, errors: null };
	}

	return {
		success: false as const,
		title: "Erro inesperado",
		description: "Tente novamente em alguns instantes.",
		errors: null,
	};
}

const createMenuCategorySchema = z.object({
	name: z.string().min(1, { message: "Informe o nome da categoria" }),
});

export async function createMenuCategoryAction(data: FormData) {
	const result = createMenuCategorySchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;

		return { success: false, title: null, description: null, errors };
	}

	const currentRestaurant = await getCurrentRestaurant();

	try {
		await createMenuCategory({
			// biome-ignore lint/style/noNonNullAssertion: always come as string
			restaurant: currentRestaurant!,
			name: result.data.name,
		});

		revalidateTag(`${currentRestaurant}/menu-categories`, "max");
	} catch (error) {
		return extractErrorState(error);
	}

	return {
		success: true,
		title: "Categoria criada!",
		description: "A categoria foi criada com sucesso.",
		errors: null,
	};
}

const createMenuItemSchema = z.object({
	categoryId: z.uuid({ message: "Selecione uma categoria" }),
	description: z.string().optional(),
	image: z
		.instanceof(File)
		.optional()
		.transform((file) => (file && file.size > 0 ? file : null)),
	name: z.string().min(1, { message: "Informe o nome do produto" }),
	price: z.coerce
		.number({ error: "Informe um preço válido" })
		.positive({ message: "O preço deve ser maior que zero" }),
});

export async function createMenuItemAction(data: FormData) {
	const result = createMenuItemSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;

		return { success: false, title: null, description: null, errors };
	}

	const { name, description, price, categoryId, image } = result.data;

	const currentRestaurant = await getCurrentRestaurant();

	try {
		await createMenuItem({
			// biome-ignore lint/style/noNonNullAssertion: always come as string
			restaurant: currentRestaurant!,
			name,
			description: description || null,
			price,
			categoryId,
			image,
		});

		revalidateTag(`${currentRestaurant}/menu-items`, "max");
	} catch (error) {
		return extractErrorState(error);
	}

	return {
		success: true,
		title: "Produto criado!",
		description: "O produto foi criado com sucesso.",
		errors: null,
	};
}

const updateMenuItemSchema = z.object({
	categoryId: z.uuid({ message: "Selecione uma categoria" }),
	description: z.string().optional(),
	image: z
		.instanceof(File)
		.optional()
		.transform((file) => (file && file.size > 0 ? file : null)),
	itemId: z.uuid(),
	markAsUnavailable: z
		.string()
		.optional()
		.transform((value) => value === "on"),
	name: z.string().min(1, { message: "Informe o nome do produto" }),
	price: z.coerce
		.number({ error: "Informe um preço válido" })
		.positive({ message: "O preço deve ser maior que zero" }),
});

export async function updateMenuItemAction(data: FormData) {
	const result = updateMenuItemSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;

		return { success: false, title: null, description: null, errors };
	}

	const {
		itemId,
		name,
		description,
		price,
		categoryId,
		markAsUnavailable,
		image,
	} = result.data;

	const currentRestaurant = await getCurrentRestaurant();

	try {
		await updateMenuItem({
			// biome-ignore lint/style/noNonNullAssertion: always come as string
			restaurant: currentRestaurant!,
			itemId,
			name,
			description: description || null,
			price,
			categoryId,
			isAvailable: !markAsUnavailable,
			image,
		});

		revalidateTag(`${currentRestaurant}/menu-items`, "max");
	} catch (error) {
		return extractErrorState(error);
	}

	return {
		success: true,
		title: "Produto atualizado!",
		description: "As informações do produto foram atualizadas com sucesso.",
		errors: null,
	};
}

interface ToggleMenuItemAvailabilityInput {
	categoryId: string;
	description: string | null;
	isAvailable: boolean;
	itemId: string;
	name: string;
	price: number;
}

export async function toggleMenuItemAvailabilityAction({
	itemId,
	name,
	description,
	price,
	categoryId,
	isAvailable,
}: ToggleMenuItemAvailabilityInput) {
	const currentRestaurant = await getCurrentRestaurant();

	try {
		await updateMenuItem({
			// biome-ignore lint/style/noNonNullAssertion: always come as string
			restaurant: currentRestaurant!,
			itemId,
			name,
			description,
			price,
			categoryId,
			isAvailable,
			image: null,
		});

		revalidateTag(`${currentRestaurant}/menu-items`, "max");
	} catch {
		// Fire-and-forget, consistent with deleteMenuItemAction.
	}
}

export async function deleteMenuItemAction(itemId: string) {
	const currentRestaurant = await getCurrentRestaurant();

	try {
		await deleteMenuItem({
			// biome-ignore lint/style/noNonNullAssertion: always come as string
			restaurant: currentRestaurant!,
			itemId,
		});

		revalidateTag(`${currentRestaurant}/menu-items`, "max");
	} catch {
		return;
	}
}
