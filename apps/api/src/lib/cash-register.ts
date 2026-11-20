export type CashRegisterTransactionType =
	| "OPENING"
	| "SUPPLY"
	| "WITHDRAWAL"
	| "CLOSING";

interface CashMovement {
	amountInCents: number;
	type: CashRegisterTransactionType;
}

/**
 * Cash physically expected in the drawer: opening float + supplies −
 * withdrawals + cash sales. CLOSING records the blind count, so it never
 * affects the balance.
 */
export function computeDrawerBalance(
	transactions: CashMovement[],
	cashSalesInCents: number
): number {
	let balance = cashSalesInCents;

	for (const { type, amountInCents } of transactions) {
		if (type === "OPENING" || type === "SUPPLY") {
			balance += amountInCents;
		} else if (type === "WITHDRAWAL") {
			balance -= amountInCents;
		}
	}

	return balance;
}

interface PaymentAggregateClient {
	payment: {
		aggregate: (args: {
			where: {
				restaurantId: string;
				method: "CASH";
				createdAt: { gte: Date };
			};
			_sum: { amountInCents: true };
		}) => Promise<{ _sum: { amountInCents: number | null } }>;
	};
}

/**
 * Sum of cash payments (net of change: `amountInCents` is the bill total)
 * received since the cash register was opened.
 */
export async function getCashSalesInCents(
	client: PaymentAggregateClient,
	restaurantId: string,
	since: Date
): Promise<number> {
	const result = await client.payment.aggregate({
		where: { restaurantId, method: "CASH", createdAt: { gte: since } },
		_sum: { amountInCents: true },
	});

	return result._sum.amountInCents ?? 0;
}
