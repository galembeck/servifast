import {
	calculateCheckoutTotals,
	checkoutTotalError,
	parsePercentage,
} from "@repo/checkout";
import { describe, expect, it } from "vitest";

describe("checkout cent rounding", () => {
	it("rounds each percentage half up and uses the subtotal for both", () => {
		expect(
			calculateCheckoutTotals(1005, {
				serviceFee: { type: "PERCENT", basisPoints: 1000 },
				discount: { type: "PERCENT", basisPoints: 500 },
			})
		).toEqual({
			subtotalInCents: 1005,
			serviceFeeInCents: 101,
			discountInCents: 50,
			amountInCents: 1056,
		});
	});
	it("preserves the old checkout without adjustments", () => {
		expect(calculateCheckoutTotals(1005)).toMatchObject({
			amountInCents: 1005,
			serviceFeeInCents: 0,
			discountInCents: 0,
		});
	});
	it("detects a total below zero", () => {
		const t = calculateCheckoutTotals(100, {
			discount: { type: "FIXED", amountInCents: 101 },
		});
		expect(checkoutTotalError(t.amountInCents)).not.toBeNull();
	});
	it.each([
		["10", 1000],
		["10,25", 1025],
		["0.01", 1],
		["100", 10_000],
		["1.005", null],
		["-1", null],
		["101", null],
		["", null],
	])("reads percent %s exactly", (text, basis) => {
		expect(parsePercentage(String(text))).toBe(basis);
	});
});
