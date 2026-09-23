import { api } from "../api-client";

interface CreateExpenseRequest {
	amount: number;
	category: string;
	date: string;
	restaurant: string;
}

export async function createExpense({
	restaurant,
	category,
	amount,
	date,
}: CreateExpenseRequest) {
	await api.post(`restaurants/${restaurant}/expenses`, {
		json: {
			category,
			amount,
			date,
		},
	});
}
