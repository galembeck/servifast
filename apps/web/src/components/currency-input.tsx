"use client";

import { type ComponentProps, useState } from "react";
import { Input } from "@/components/ui/input";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

const NON_DIGIT_PATTERN = /\D/g;

interface CurrencyInputProps
	extends Omit<ComponentProps<typeof Input>, "name" | "onChange" | "value"> {
	defaultValueInCents?: number;
	name: string;
}

export function CurrencyInput({
	name,
	defaultValueInCents = 0,
	...props
}: CurrencyInputProps) {
	const [cents, setCents] = useState(defaultValueInCents);

	function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
		const digits = event.target.value.replace(NON_DIGIT_PATTERN, "");

		setCents(digits ? Number(digits) : 0);
	}

	return (
		<>
			<input name={name} type="hidden" value={(cents / 100).toFixed(2)} />

			<Input
				{...props}
				inputMode="numeric"
				onChange={handleChange}
				value={currencyFormatter.format(cents / 100)}
			/>
		</>
	);
}
