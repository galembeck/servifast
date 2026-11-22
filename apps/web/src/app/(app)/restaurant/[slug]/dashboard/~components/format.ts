import type {
	SalesPaymentMethod,
	SalesPeriod,
} from "@/api/http/services/get-sales-report";

const CENTS_PER_REAL = 100;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

const compactCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
	notation: "compact",
	maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("pt-BR");

const percentFormatter = new Intl.NumberFormat("pt-BR", {
	style: "percent",
	maximumFractionDigits: 0,
	signDisplay: "exceptZero",
});

// Bucket keys are already local dates: format them as UTC so the browser's
// own time zone never shifts the day.
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
	weekday: "short",
	timeZone: "UTC",
});
const dayMonthFormatter = new Intl.DateTimeFormat("pt-BR", {
	day: "2-digit",
	month: "2-digit",
	timeZone: "UTC",
});
const longDayFormatter = new Intl.DateTimeFormat("pt-BR", {
	weekday: "long",
	day: "numeric",
	month: "long",
	timeZone: "UTC",
});

// Fixed zone so the server render and the browser agree (no hydration diff)
// and times match the restaurant's local periods.
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	timeZone: "America/Sao_Paulo",
});

export function formatPrice(amountInCents: number) {
	return currencyFormatter.format(amountInCents / CENTS_PER_REAL);
}

export function formatCompactPrice(amountInCents: number) {
	return compactCurrencyFormatter.format(amountInCents / CENTS_PER_REAL);
}

export function formatInteger(value: number) {
	return integerFormatter.format(value);
}

export function formatPercentChange(ratio: number) {
	return percentFormatter.format(ratio);
}

export function formatTime(date: string) {
	return timeFormatter.format(new Date(date));
}

function bucketDate(bucket: string) {
	const [datePart = ""] = bucket.split("T");
	return new Date(`${datePart}T00:00:00Z`);
}

function bucketHour(bucket: string) {
	return Number(bucket.split("T")[1] ?? 0);
}

/** Short axis label: "10h", "sáb 21" or "21/11". */
export function formatBucketTick(bucket: string, period: SalesPeriod) {
	if (period === "today") {
		return `${bucketHour(bucket)}h`;
	}

	const date = bucketDate(bucket);

	if (period === "week") {
		const weekday = weekdayFormatter.format(date).replace(".", "");
		return `${weekday} ${date.getUTCDate()}`;
	}

	return dayMonthFormatter.format(date);
}

/** Full label for tooltips and the table view. */
export function formatBucketLabel(bucket: string, period: SalesPeriod) {
	if (period === "today") {
		const hour = bucketHour(bucket);
		return `${hour}h – ${hour + 1}h`;
	}

	return longDayFormatter.format(bucketDate(bucket));
}

export const PERIOD_LABELS: Record<SalesPeriod, string> = {
	today: "Hoje",
	week: "Semana",
	month: "Mês",
};

export const COMPARISON_LABELS: Record<SalesPeriod, string> = {
	today: "ontem até este horário",
	week: "semana passada até este ponto",
	month: "mês passado até este ponto",
};

export const PAYMENT_METHOD_LABELS: Record<SalesPaymentMethod, string> = {
	CASH: "Dinheiro",
	CREDIT_CARD: "Crédito",
	DEBIT_CARD: "Débito",
	PIX: "PIX",
};
