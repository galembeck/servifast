const CPF_LENGTH = 11;
const FIRST_CHECK_DIGIT_WEIGHT_START = 10;
const SECOND_CHECK_DIGIT_WEIGHT_START = 11;
const CHECK_DIGIT_MODULO = 11;
const CHECK_DIGIT_REMAINDER_THRESHOLD = 2;
const NON_DIGIT_REGEX = /\D/g;
const ALL_REPEATED_DIGITS_REGEX = /^(\d)\1+$/;
const CPF_FIRST_GROUP_REGEX = /(\d{3})(\d)/;
const CPF_SECOND_GROUP_REGEX = /(\d{3})(\d)/;
const CPF_LAST_GROUP_REGEX = /(\d{3})(\d{1,2})$/;

function calculateCheckDigit(digits: number[], weightStart: number): number {
	const sum = digits.reduce(
		(accumulator, digit, index) => accumulator + digit * (weightStart - index),
		0
	);

	const remainder = sum % CHECK_DIGIT_MODULO;

	return remainder < CHECK_DIGIT_REMAINDER_THRESHOLD
		? 0
		: CHECK_DIGIT_MODULO - remainder;
}

export function onlyDigits(value: string): string {
	return value.replace(NON_DIGIT_REGEX, "");
}

export function isLikelyEmail(value: string): boolean {
	return value.includes("@");
}

export function isValidCpf(value: string): boolean {
	const digitsOnly = onlyDigits(value);

	if (digitsOnly.length !== CPF_LENGTH) {
		return false;
	}

	if (ALL_REPEATED_DIGITS_REGEX.test(digitsOnly)) {
		return false;
	}

	const digits = digitsOnly.split("").map(Number);

	const firstCheckDigit = calculateCheckDigit(
		digits.slice(0, 9),
		FIRST_CHECK_DIGIT_WEIGHT_START
	);

	if (firstCheckDigit !== digits[9]) {
		return false;
	}

	const secondCheckDigit = calculateCheckDigit(
		digits.slice(0, 10),
		SECOND_CHECK_DIGIT_WEIGHT_START
	);

	return secondCheckDigit === digits[10];
}

export function formatCpf(value: string): string {
	const digits = onlyDigits(value).slice(0, CPF_LENGTH);

	return digits
		.replace(CPF_FIRST_GROUP_REGEX, "$1.$2")
		.replace(CPF_SECOND_GROUP_REGEX, "$1.$2")
		.replace(CPF_LAST_GROUP_REGEX, "$1-$2");
}
