import { splitCheckout } from "@repo/checkout";
import { describe, expect, it } from "vitest";

const item = { id: "a", quantity: 3, unitPriceInCents: 755 };
describe("split checkout rounding and assignment", () => {
	it("distributes 100 reais across three people deterministically", () => {
		const plan = splitCheckout(
			[{ id: "a", quantity: 1, unitPriceInCents: 10_000 }],
			{ mode: "PEOPLE", people: 3 }
		);
		expect(plan.parts.map((p) => p.amountInCents)).toEqual([3334, 3333, 3333]);
	});
	it("assigns units of one item across clients and apportions adjustments", () => {
		const plan = splitCheckout([item], {
			mode: "ITEMS",
			serviceFee: { type: "PERCENT", basisPoints: 1000 },
			discount: { type: "FIXED", amountInCents: 100 },
			clients: [
				{ name: "A", items: [{ itemId: "a", quantity: 1 }] },
				{ name: "B", items: [{ itemId: "a", quantity: 2 }] },
			],
		});
		expect(plan.parts.map((p) => p.amountInCents)).toEqual([798, 1594]);
		expect(plan.parts.map((p) => p.serviceFeeInCents)).toEqual([76, 151]);
		expect(plan.parts.map((p) => p.discountInCents)).toEqual([33, 67]);
	});
	it.each([
		[1, 1],
		[1, 3],
		[0, 3],
		[-1, 4],
	])("rejects missing, duplicated or excessive quantities %j", (a, b) => {
		expect(() =>
			splitCheckout([item], {
				mode: "ITEMS",
				clients: [
					{ name: "A", items: [{ itemId: "a", quantity: a }] },
					{ name: "B", items: [{ itemId: "a", quantity: b }] },
				],
			})
		).toThrow(RangeError);
	});
	it("rejects an ineligible/cancelled item", () => {
		expect(() =>
			splitCheckout([item], {
				mode: "ITEMS",
				clients: [
					{ name: "A", items: [{ itemId: "a", quantity: 3 }] },
					{ name: "B", items: [{ itemId: "cancelled", quantity: 1 }] },
				],
			})
		).toThrow(RangeError);
	});
	it("caps discount allocation to prevent a negative share in largest-remainder edge cases", () => {
		const weights = [1500, 1500, 900, 500, 500, 200];
		const items = weights.map((price, i) => ({
			id: String(i),
			quantity: 1,
			unitPriceInCents: price,
		}));
		const plan = splitCheckout(items, {
			mode: "ITEMS",
			serviceFee: { type: "FIXED", amountInCents: 26 },
			discount: { type: "FIXED", amountInCents: 5125 },
			clients: items.map((i) => ({
				name: i.id,
				items: [{ itemId: i.id, quantity: 1 }],
			})),
		});
		expect(plan.parts.every((p) => p.amountInCents >= 0)).toBe(true);
		expect(plan.parts.reduce((sum, p) => sum + p.amountInCents, 0)).toBe(1);
		expect(
			plan.parts.reduce((sum, p) => sum + (p.discountInCents ?? 0), 0)
		).toBe(5125);
	});
	it("keeps all monetary sums exact for many deterministic item/adjustment combinations", () => {
		for (let n = 2; n <= 30; n++) {
			const items = Array.from({ length: n }, (_, i) => ({
				id: String(i),
				quantity: 1,
				unitPriceInCents: (i + 1) * 37,
			}));
			const plan = splitCheckout(items, {
				mode: "ITEMS",
				serviceFee: { type: "PERCENT", basisPoints: 1250 },
				discount: { type: "PERCENT", basisPoints: 1725 },
				clients: items.map((i) => ({
					name: i.id,
					items: [{ itemId: i.id, quantity: 1 }],
				})),
			});
			expect(plan.parts.reduce((sum, p) => sum + p.amountInCents, 0)).toBe(
				plan.totals.amountInCents
			);
			expect(
				plan.parts.reduce((sum, p) => sum + (p.serviceFeeInCents ?? 0), 0)
			).toBe(plan.totals.serviceFeeInCents);
			expect(
				plan.parts.reduce((sum, p) => sum + (p.discountInCents ?? 0), 0)
			).toBe(plan.totals.discountInCents);
			expect(plan.parts.every((p) => p.amountInCents >= 0)).toBe(true);
		}
	});
});
