"use server";
import type { CheckoutAdjustments } from "@repo/checkout";
import { HTTPError } from "ky";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { addTabItem } from "@/api/http/services/add-tab-item";
import {
	createBillSplit,
	payBillInvoice,
	previewBillSplit,
	type SplitRequest,
} from "@/api/http/services/bill-split";
import { cancelTabItem } from "@/api/http/services/cancel-tab-item";
import { closeTab, type PaymentMethod } from "@/api/http/services/close-tab";
import { deliverTabItem } from "@/api/http/services/deliver-tab-item";
import { requestBill } from "@/api/http/services/request-bill";
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
			const {
				message,
				title = null,
				description = null,
			} = (error.data ?? {}) as {
				description?: string | null;
				message?: string;
				title?: string | null;
			};

			if (message === "ITEM_OUT_OF_STOCK") {
				// The balance changed since the sheet was opened: refresh it.
				revalidateTag(`${currentRestaurant}/menu-items`, "max");

				return {
					success: false,
					title: "Estoque insuficiente",
					description:
						"Não há unidades suficientes deste produto. Reduza a quantidade ou escolha outro item.",
					errors: null,
				};
			}

			return { success: false, title, description, errors: null };
		}

		return {
			success: false,
			title: "Erro inesperado",
			description: "Tente novamente em alguns instantes.",
			errors: null,
		};
	}

	revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "max");

	return {
		success: true,
		title: "Item adicionado!",
		description: "O item foi adicionado à comanda.",
		errors: null,
	};
}

export async function cancelTabItemAction(
	tabId: string,
	itemId: string,
	force = false
) {
	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	try {
		await cancelTabItem({
			restaurant: currentRestaurant,
			tabId,
			itemId,
			force,
		});
	} catch (error) {
		if (error instanceof HTTPError) {
			const { title = null, description = null } = (error.data ?? {}) as {
				title?: string | null;
				description?: string | null;
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

	revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "max");

	return {
		success: true,
		title: force ? "Cancelamento forçado concluído." : "Item cancelado.",
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
			const { title = null, description = null } = (error.data ?? {}) as {
				title?: string | null;
				description?: string | null;
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

	revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "max");

	return {
		success: true,
		title: "Pedido enviado para a cozinha!",
		description: null,
		errors: null,
	};
}

const DELIVER_ERROR_MESSAGES: Record<string, string> = {
	ORDER_ITEM_NOT_READY:
		"Este item não está pronto ou já foi entregue. A comanda foi atualizada.",
	ORDER_ITEM_NOT_FOUND: "Item não encontrado nesta comanda.",
	TAB_NOT_OPEN: "Esta comanda já foi fechada.",
	FORBIDDEN: "Você não tem permissão para marcar itens como entregues.",
};

export async function deliverTabItemAction(tabId: string, itemId: string) {
	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	try {
		await deliverTabItem({ restaurant: currentRestaurant, tabId, itemId });
	} catch (error) {
		// Refresh either way: the item may have changed elsewhere.
		revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "max");

		if (error instanceof HTTPError) {
			const data = (error.data ?? {}) as {
				message?: string;
				title?: string | null;
			};

			return {
				success: false,
				title:
					(data.message && DELIVER_ERROR_MESSAGES[data.message]) ||
					data.title ||
					"Erro ao marcar o item como entregue.",
			};
		}

		return {
			success: false,
			title: "Erro inesperado. Tente novamente em alguns instantes.",
		};
	}

	revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "max");

	return { success: true, title: "Item entregue!" };
}

const CLOSE_TAB_ERROR_MESSAGES: Record<string, string> = {
	INVALID_CHECKOUT_ADJUSTMENTS:
		"Confira a taxa e o desconto: o total não pode ser negativo.",
	TAB_HAS_PENDING_ITEMS:
		"Ainda há itens não entregues. Entregue ou cancele antes de fechar a conta.",
	TAB_NOT_OPEN: "Esta comanda já foi fechada ou recebeu itens novos.",
	TAB_NOT_FOUND: "Comanda não encontrada.",
	CASH_RECEIVED_AMOUNT_REQUIRED: "Informe o valor recebido em dinheiro.",
	INSUFFICIENT_CASH_AMOUNT: "O valor recebido não cobre o total da conta.",
	FORBIDDEN: "Você não tem permissão para fechar contas.",
};

/** 409 INSUFFICIENT_STOCK: the API lists the shortages, e.g. "Chopp ×1". */
function insufficientStockMessage(shortages: string | null | undefined) {
	const missing = shortages ? ` Faltam: ${shortages}.` : "";

	return `Estoque insuficiente para fechar a conta.${missing} Ajuste o saldo na tela de produtos ou cancele o item.`;
}

export async function closeTabAction(
	tabId: string,
	method: PaymentMethod,
	receivedInCents?: number,
	adjustments: CheckoutAdjustments = {}
) {
	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	try {
		const { payment } = await closeTab({
			restaurant: currentRestaurant,
			tabId,
			method,
			receivedInCents,
			serviceFee: adjustments.serviceFee,
			discount: adjustments.discount,
		});

		revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "max");
		revalidateTag(`${currentRestaurant}/tables`, "max");
		// Closing decremented the stock of the products sold.
		revalidateTag(`${currentRestaurant}/menu-items`, "max");

		return { success: true as const, title: "Conta fechada!", payment };
	} catch (error) {
		// Refresh either way: the tab may have been closed elsewhere.
		revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "max");

		if (error instanceof HTTPError) {
			const data = (error.data ?? {}) as {
				description?: string | null;
				message?: string;
				title?: string | null;
			};

			if (data.message === "INSUFFICIENT_STOCK") {
				return {
					success: false as const,
					title: insufficientStockMessage(data.description),
				};
			}

			return {
				success: false as const,
				title:
					(data.message && CLOSE_TAB_ERROR_MESSAGES[data.message]) ||
					data.title ||
					"Erro ao fechar a conta.",
			};
		}

		return {
			success: false as const,
			title: "Erro inesperado. Tente novamente em alguns instantes.",
		};
	}
}

const REQUEST_BILL_ERROR_MESSAGES: Record<string, string> = {
	TABLE_NOT_OCCUPIED: "A conta desta mesa já foi pedida.",
	TAB_NOT_OPEN: "Esta comanda já foi fechada.",
	TAB_NOT_FOUND: "Comanda não encontrada.",
	FORBIDDEN: "Você não tem permissão para pedir a conta.",
};

export async function requestBillAction(tabId: string) {
	// biome-ignore lint/style/noNonNullAssertion: always comes as string
	const currentRestaurant = (await getCurrentRestaurant())!;

	try {
		await requestBill({ restaurant: currentRestaurant, tabId });
	} catch (error) {
		// Refresh either way: the table may have changed elsewhere.
		revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "max");

		if (error instanceof HTTPError) {
			const data = (error.data ?? {}) as {
				message?: string;
				title?: string | null;
			};

			return {
				success: false,
				title:
					(data.message && REQUEST_BILL_ERROR_MESSAGES[data.message]) ||
					data.title ||
					"Erro ao pedir a conta.",
			};
		}

		return {
			success: false,
			title: "Erro inesperado. Tente novamente em alguns instantes.",
		};
	}

	revalidateTag(`${currentRestaurant}/tabs/${tabId}`, "max");
	revalidateTag(`${currentRestaurant}/tables`, "max");

	return { success: true, title: "Conta pedida!" };
}
function splitError(error: unknown) {
	if (error instanceof HTTPError) {
		const data = error.data as
			| { description?: string; title?: string; message?: string }
			| undefined;
		if (data?.message === "INSUFFICIENT_STOCK") {
			return insufficientStockMessage(data.description);
		}
		return (
			data?.description ??
			data?.title ??
			"Não foi possível concluir a operação."
		);
	}
	return "Não foi possível conectar ao servidor. Tente novamente.";
}
export async function previewSplitAction(tabId: string, input: SplitRequest) {
	try {
		const restaurant = await getCurrentRestaurant();
		if (!restaurant) {
			throw new Error("Missing restaurant");
		}
		const result = await previewBillSplit(restaurant, tabId, input);
		return { success: true as const, ...result };
	} catch (error) {
		return { success: false as const, title: splitError(error) };
	}
}
function refreshSplit(restaurant: string, tabId: string) {
	revalidateTag(`${restaurant}/tabs/${tabId}`, "max");
	revalidateTag(`${restaurant}/tables`, "max");
	revalidateTag(`${restaurant}/menu-items`, "max");
	revalidatePath(`/restaurant/${restaurant}/tabs/${tabId}`);
}
export async function createSplitAction(tabId: string, input: SplitRequest) {
	try {
		const restaurant = await getCurrentRestaurant();
		if (!restaurant) {
			throw new Error("Missing restaurant");
		}
		const result = await createBillSplit(restaurant, tabId, input);
		refreshSplit(restaurant, tabId);
		return { success: true as const, ...result };
	} catch (error) {
		return { success: false as const, title: splitError(error) };
	}
}
export async function payInvoiceAction(
	tabId: string,
	id: string,
	input: { method: PaymentMethod; receivedInCents?: number }
) {
	try {
		const restaurant = await getCurrentRestaurant();
		if (!restaurant) {
			throw new Error("Missing restaurant");
		}
		const result = await payBillInvoice(restaurant, tabId, id, input);
		refreshSplit(restaurant, tabId);
		return { success: true as const, ...result };
	} catch (error) {
		return { success: false as const, title: splitError(error) };
	}
}
