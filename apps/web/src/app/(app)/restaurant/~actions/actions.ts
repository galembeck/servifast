/** biome-ignore-all lint/suspicious/useAwait: required by server actions */

"use server";

import { HTTPError } from "ky";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createRestaurant } from "@/api/http/services/create-restaurant";
import { updateRestaurant } from "@/api/http/services/update-restaurant";
import { getCurrentRestaurant } from "@/providers/auth-provider";

const restaurantSchema = z
	.object({
		name: z.string().min(4, {
			message: "The restaurant's name should have at least 4 characters",
		}),
		domain: z
			.string()
			.nullable()
			.refine(
				(value) => {
					if (value) {
						// biome-ignore lint/performance/useTopLevelRegex: not required to be top-level
						const domainRegex = /^[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/;

						return domainRegex.test(value);
					}

					return true;
				},
				{
					message: "The restaurant's domain should be valid (e.g. example.com)",
				}
			),
		shouldAttachUsersByDomain: z
			.union([z.literal("on"), z.literal("off"), z.boolean()])
			.transform((value) => value === true || value === "on")
			.default(false),
	})
	.refine(
		(data) => {
			if (data.shouldAttachUsersByDomain === true && !data.domain) {
				return false;
			}

			return true;
		},
		{
			message: "Restaurant's domain is required when auto-join is enabled",
			path: ["domain"],
		}
	);

export type RestaurantSchema = z.infer<typeof restaurantSchema>;

export async function createRestaurantAction(data: FormData) {
	const result = restaurantSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;

		return { success: false, title: null, description: null, errors };
	}

	const { name, domain, shouldAttachUsersByDomain } = result.data;

	try {
		await createRestaurant({ name, domain, shouldAttachUsersByDomain });

		revalidateTag("restaurants", "max");
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
			title: "Unexpected error",
			description: "Try again in a few minutes.",
			errors: null,
		};
	}

	return {
		success: true,
		title: "Restaurant saved!",
		description: "Successfully saved your restaurant.",
		errors: null,
	};
}

export async function updateRestaurantAction(data: FormData) {
	const currentRestaurant = await getCurrentRestaurant();

	const result = restaurantSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;

		return { success: false, title: null, description: null, errors };
	}

	const { name, domain, shouldAttachUsersByDomain } = result.data;

	try {
		await updateRestaurant({
			// biome-ignore lint/style/noNonNullAssertion: always come as a string
			restaurant: currentRestaurant!,
			name,
			domain,
			shouldAttachUsersByDomain,
		});

		revalidateTag("restaurants", "max");
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
			title: "Unexpected error",
			description: "Try again in a few minutes.",
			errors: null,
		};
	}

	return {
		success: true,
		title: "Restaurant saved!",
		description: "Successfully saved your restaurant.",
		errors: null,
	};
}
