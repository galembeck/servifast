import { describe, expect, it } from "vitest";
import {
	formatStockShortages,
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
