/** biome-ignore-all lint/suspicious/useAwait: required by server actions */

"use server";

import { revalidateTag } from "next/cache";
import { DeleteProject } from "@/api/http/services/delete-project";
import { getCurrentRestaurant } from "@/providers/auth-provider";

export async function deleteProjectAction(projectId: string) {
	const currentRestaurant = await getCurrentRestaurant();

	await DeleteProject({
		projectId,
		// biome-ignore lint/style/noNonNullAssertion: always come as string
		restaurant: currentRestaurant!,
	});

	revalidateTag(`${currentRestaurant}/projects`, "max");
}
