import { api } from "../api-client";

interface CloseCashRegisterRequest {
	countedAmountInCents: number;
	restaurant: string;
}

interface CloseCashRegisterResponse {
	session: {
		id: string;
		openedAt: string;
		closedAt: string;
		openingAmountInCents: number;
		suppliesInCents: number;
		withdrawalsInCents: number;
		cashSalesInCents: number;
		expectedAmountInCents: number;
		countedAmountInCents: number;
		differenceInCents: number;
	};
}

export type CashRegisterClosing = CloseCashRegisterResponse["session"];

export async function closeCashRegister({
	countedAmountInCents,
	restaurant,
}: CloseCashRegisterRequest) {
	const result = await api
		.post(`restaurants/${restaurant}/cash-register/close`, {
			json: { countedAmountInCents },
		})
		.json<CloseCashRegisterResponse>();

	return result;
}
