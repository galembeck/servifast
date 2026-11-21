import { describe, expect, it } from "vitest";
import {
	formatStockShortages,
	resolveStockSettings,
	stockQuantityFieldSchema,
	sumQuantitiesByMenuItem,
} from "./stock";

describe("sumQuantitiesByMenuItem", () => {
	it("sums the units sold of each product (1:1 rule)", () => {
		const quantities = sumQuantitiesByMenuItem([
			{ menuItemId: "chopp", quantity: 2 },
			{ menuItemId: "suco", quantity: 1 },
			{ menuItemId: "chopp", quantity: 3 },
		]);

		expect(Object.fromEntries(quantities)).toEqual({ chopp: 5, suco: 1 });
	});
});

describe("formatStockShortages", () => {
	it("lists each product with the missing units", () => {
		expect(
			formatStockShortages([
				{ name: "Chopp", missing: 1 },
				{ name: "Suco", missing: 2 },
			])
		).toBe("Chopp ×1, Suco ×2");
	});
});

describe("resolveStockSettings", () => {
	const current = { stockQuantity: 10, minStockQuantity: 4 };

	it("uses the values sent", () => {
		expect(
			resolveStockSettings({ stockQuantity: 8, minStockQuantity: 3 }, current)
		).toEqual({ stockQuantity: 8, minStockQuantity: 3 });
	});

	it("keeps the current values for missing fields", () => {
		expect(
			resolveStockSettings(
				{ stockQuantity: undefined, minStockQuantity: undefined },
				current
			)
		).toEqual(current);
	});

	it("clears the minimum when stock tracking stops", () => {
		expect(
			resolveStockSettings(
				{ stockQuantity: null, minStockQuantity: undefined },
				current
			)
		).toEqual({ stockQuantity: null, minStockQuantity: null });
	});

	it.each([
		[{ stockQuantity: null, minStockQuantity: 5 }, current],
		[
			{ stockQuantity: undefined, minStockQuantity: 5 },
			{ stockQuantity: null, minStockQuantity: null },
		],
	])("rejects a minimum without stock tracking (%j)", (input, existing) => {
		expect(() => resolveStockSettings(input, existing)).toThrow(
			expect.objectContaining({ code: "MIN_STOCK_REQUIRES_TRACKING" })
		);
	});
});

describe("stockQuantityFieldSchema", () => {
	it.each([
		[undefined, undefined],
		["", null],
		["  ", null],
		["0", 0],
		[" 12 ", 12],
	])("parses %j as %j", (input, expected) => {
		expect(stockQuantityFieldSchema.parse(input)).toBe(expected);
	});

	it.each(["-1", "1.5", "abc"])("rejects %j", (input) => {
		expect(stockQuantityFieldSchema.safeParse(input).success).toBe(false);
	});
});
