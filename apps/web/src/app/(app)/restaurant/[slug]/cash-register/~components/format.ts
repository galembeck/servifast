import type { CashRegisterTransactionType } from "@/api/http/services/get-cash-register-transactions";

const CENTS_PER_REAL = 100;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
	hour: "2-digit",
	minute: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
	dateStyle: "short",
	timeStyle: "short",
});

export function formatPrice(amountInCents: number) {
	return currencyFormatter.format(amountInCents / CENTS_PER_REAL);
}

export function formatTime(date: string) {
	return timeFormatter.format(new Date(date));
}

export function formatDateTime(date: string) {
	return dateTimeFormatter.format(new Date(date));
}

export const TRANSACTION_TYPE_LABELS: Record<
	CashRegisterTransactionType,
	string
> = {
	OPENING: "Abertura",
	SUPPLY: "Suprimento",
	WITHDRAWAL: "Sangria",
	CLOSING: "Fechamento",
};
