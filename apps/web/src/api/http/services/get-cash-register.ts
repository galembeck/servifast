import { api } from "../api-client";

interface GetCashRegisterResponse {
	session: {
		id: string;
		openingAmountInCents: number;
		openedAt: string;
		openedBy: { id: string; name: string | null };
	} | null;
}

export type OpenCashRegisterSession = NonNullable<
	GetCashRegisterResponse["session"]
>;

export async function getCashRegister(slug: string) {
	const result = await api
		.get(`restaurants/${slug}/cash-register`, {
			next: {
				tags: [`${slug}/cash-register`],
			},
		})
		.json<GetCashRegisterResponse>();

	return result;
}
