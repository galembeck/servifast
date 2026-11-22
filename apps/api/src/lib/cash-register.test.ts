import { describe, expect, it, vi } from "vitest";
import { computeDrawerBalance, getCashSalesInCents } from "./cash-register";

describe("computeDrawerBalance", () => {
	it("adds opening and supplies, subtracts withdrawals and adds cash sales", () => {
		const balance = computeDrawerBalance(
			[
				{ type: "OPENING", amountInCents: 10_000 },
				{ type: "SUPPLY", amountInCents: 5000 },
				{ type: "WITHDRAWAL", amountInCents: 3000 },
			],
			7550
		);

		expect(balance).toBe(10_000 + 5000 - 3000 + 7550);
	});

	it("ignores the CLOSING movement (it records the blind count)", () => {
		const balance = computeDrawerBalance(
			[
				{ type: "OPENING", amountInCents: 10_000 },
				{ type: "CLOSING", amountInCents: 99_999 },
			],
			0
		);

		expect(balance).toBe(10_000);
	});
});

describe("getCashSalesInCents", () => {
	it("sums cash payments since the opening and treats no payments as zero", async () => {
		const since = new Date();
		const aggregate = vi
			.fn()
			.mockResolvedValue({ _sum: { amountInCents: null } });

		const total = await getCashSalesInCents(
			{ payment: { aggregate } },
			"restaurant-id",
			since
		);

		expect(total).toBe(0);
		expect(aggregate).toHaveBeenCalledWith({
			where: {
				restaurantId: "restaurant-id",
				method: "CASH",
				createdAt: { gte: since },
			},
			_sum: { amountInCents: true },
		});
	});
});
