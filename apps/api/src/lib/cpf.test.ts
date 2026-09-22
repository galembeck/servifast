import { describe, expect, it } from "vitest";
import { isValidCpf } from "@/lib/cpf";

describe("isValidCpf", () => {
	it("accepts a valid CPF with formatting", () => {
		expect(isValidCpf("529.982.247-25")).toBe(true);
	});

	it("accepts a valid CPF without formatting", () => {
		expect(isValidCpf("52998224725")).toBe(true);
	});

	it("rejects a CPF with an invalid check digit", () => {
		expect(isValidCpf("529.982.247-26")).toBe(false);
	});

	it("rejects a CPF with all repeated digits", () => {
		expect(isValidCpf("111.111.111-11")).toBe(false);
	});

	it("rejects a value with the wrong length", () => {
		expect(isValidCpf("123456789")).toBe(false);
	});

	it("rejects an empty value", () => {
		expect(isValidCpf("")).toBe(false);
	});
});
