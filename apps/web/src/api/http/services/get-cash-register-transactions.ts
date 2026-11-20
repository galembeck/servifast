import { api } from "../api-client";

export type CashRegisterTransactionType =
	| "OPENING"
	| "SUPPLY"
	| "WITHDRAWAL"
	| "CLOSING";

export interface CashRegisterTransaction {
	amountInCents: number;
	createdAt: string;
	description: string | null;
	id: string;
	operator: { id: string; name: string | null };
	type: CashRegisterTransactionType;
}

interface GetCashRegisterTransactionsResponse {
	session: {
		id: string;
		openedAt: string;
		closedAt: string | null;
		openingAmountInCents: number;
		countedAmountInCents: number | null;
		expectedAmountInCents: number | null;
		differenceInCents: number | null;
	} | null;
	transactions: CashRegisterTransaction[];
}

export async function getCashRegisterTransactions(
	slug: string,
	sessionId?: string
) {
	const result = await api
		.get(`restaurants/${slug}/cash-register/transactions`, {
			searchParams: sessionId ? { sessionId } : undefined,
			next: {
				tags: [`${slug}/cash-register`],
			},
		})
		.json<GetCashRegisterTransactionsResponse>();

	return result;
}
