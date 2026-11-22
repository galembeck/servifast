import { api } from "../api-client";

interface OpenCashRegisterRequest {
	openingAmountInCents: number;
	restaurant: string;
}

interface OpenCashRegisterResponse {
	session: {
		id: string;
		openingAmountInCents: number;
		openedAt: string;
	};
	transaction: {
		id: string;
		type: "OPENING";
		amountInCents: number;
		operatorId: string;
		createdAt: string;
	};
}

export async function openCashRegister({
	openingAmountInCents,
	restaurant,
}: OpenCashRegisterRequest) {
	const result = await api
		.post(`restaurants/${restaurant}/cash-register/open`, {
			json: { openingAmountInCents },
		})
		.json<OpenCashRegisterResponse>();

	return result;
}
