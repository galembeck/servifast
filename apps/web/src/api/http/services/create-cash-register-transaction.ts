import { api } from "../api-client";

export type CashMovementType = "SUPPLY" | "WITHDRAWAL";

interface CreateCashRegisterTransactionRequest {
	amountInCents: number;
	description?: string;
	restaurant: string;
	type: CashMovementType;
}

interface CreateCashRegisterTransactionResponse {
	transaction: {
		id: string;
		type: CashMovementType;
		amountInCents: number;
		description: string | null;
		operatorId: string;
		sessionId: string;
		createdAt: string;
	};
}

export async function createCashRegisterTransaction({
	amountInCents,
	description,
	restaurant,
	type,
}: CreateCashRegisterTransactionRequest) {
	const result = await api
		.post(`restaurants/${restaurant}/cash-register/transactions`, {
			json: { type, amountInCents, description },
		})
		.json<CreateCashRegisterTransactionResponse>();

	return result;
}
