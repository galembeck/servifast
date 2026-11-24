"use client";
import { type CheckoutAdjustment, parsePercentage } from "@repo/checkout";
import { useId, useState } from "react";
import { CurrencyInput } from "@/components/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
export function CheckoutAdjustmentInput({
	label,
	value,
	onChange,
}: {
	label: string;
	value: CheckoutAdjustment;
	onChange: (value: CheckoutAdjustment) => void;
}) {
	const id = useId();
	const [percent, setPercent] = useState(
		value.type === "PERCENT" ? String(value.basisPoints / 100) : "0"
	);
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<div className="flex gap-2">
				<Select
					onValueChange={(type) => {
						setPercent("0");
						onChange(
							type === "FIXED"
								? { type: "FIXED", amountInCents: 0 }
								: { type: "PERCENT", basisPoints: 0 }
						);
					}}
					value={value.type}
				>
					<SelectTrigger aria-label={`${label}: tipo`} className="w-24">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="FIXED">R$</SelectItem>
						<SelectItem value="PERCENT">%</SelectItem>
					</SelectContent>
				</Select>
				{value.type === "FIXED" ? (
					<CurrencyInput
						id={id}
						name={id}
						onValueChange={(amountInCents) =>
							onChange({ type: "FIXED", amountInCents })
						}
						valueInCents={value.amountInCents}
					/>
				) : (
					<Input
						id={id}
						inputMode="decimal"
						onChange={(event) => {
							setPercent(event.target.value);
							onChange({
								type: "PERCENT",
								basisPoints: parsePercentage(event.target.value) ?? -1,
							});
						}}
						value={percent}
					/>
				)}
			</div>
		</div>
	);
}
