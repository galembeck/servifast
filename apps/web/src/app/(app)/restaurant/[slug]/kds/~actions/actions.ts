"use server";

import { HTTPError } from "ky";
import {
	type KitchenTargetStatus,
	updateKdsItemStatus,
} from "@/api/http/services/update-kds-item-status";
import { getCurrentRestaurant } from "@/providers/auth-provider";

const ERROR_MESSAGES: Record<string, string> = {
	INVALID_STATUS_TRANSITION:
		"Esse item já mudou de status. A fila foi atualizada.",
	KITCHEN_ITEM_NOT_FOUND: "Item não encontrado na fila da cozinha.",
	TAB_NOT_OPEN: "A comanda deste item já foi fechada.",
	FORBIDDEN: "Você não tem permissão para alterar o status dos itens.",
};

export async function updateKdsItemStatusAction(
	itemId: string,
	status: KitchenTargetStatus
) {
	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	try {
		const { item } = await updateKdsItemStatus({
			restaurant: currentRestaurant,
			itemId,
			status,
		});

		return { success: true as const, item, title: null };
	} catch (error) {
		if (error instanceof HTTPError) {
			// ky v2 already consumed the body into `error.data`; calling
			// `error.response.json()` again throws "Body has already been read".
			const data = error.data as
				| { message?: string; title?: string | null }
				| undefined;

			return {
				success: false as const,
				item: null,
				title:
					(data?.message && ERROR_MESSAGES[data.message]) ||
					data?.title ||
					null,
			};
		}

		return { success: false as const, item: null, title: null };
	}
}
