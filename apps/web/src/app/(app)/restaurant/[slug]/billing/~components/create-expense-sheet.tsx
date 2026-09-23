"use client";

import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { CurrencyInput } from "@/components/currency-input";
import { DatePickerInput } from "@/components/date-picker-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { useFormState } from "@/hooks/use-form-state";
import { createExpenseAction } from "../~actions/actions";

const EXPENSE_CATEGORIES = [
	"Ingredientes",
	"Salários",
	"Aluguel",
	"Utilidades",
	"Manutenção",
	"Marketing",
	"Impostos",
	"Outros",
];

export function CreateExpenseSheet() {
	const [open, setOpen] = useState(false);
	const [category, setCategory] = useState("");

	const [
		{ success, title, description, errors },
		handleCreateExpense,
		isPending,
	] = useFormState(createExpenseAction, () => {
		setOpen(false);
		setCategory("");
	});

	return (
		<Sheet onOpenChange={setOpen} open={open}>
			<SheetTrigger asChild>
				<Button size="sm">
					<Plus className="mr-2 size-4" />
					Registrar despesa
				</Button>
			</SheetTrigger>

			<SheetContent>
				<SheetHeader>
					<SheetTitle>Registrar despesa</SheetTitle>
				</SheetHeader>

				<form
					className="space-y-4 px-4"
					id="create-expense-form"
					onSubmit={handleCreateExpense}
				>
					{success === false && (title ?? description) && (
						<Alert variant="destructive">
							<AlertTriangle className="size-4" />

							<AlertTitle>{title ?? "Erro ao registrar despesa!"}</AlertTitle>

							{description && (
								<AlertDescription>
									<p>{description}</p>
								</AlertDescription>
							)}
						</Alert>
					)}

					<div className="space-y-3">
						<Label htmlFor="amount">Valor (R$)</Label>

						<CurrencyInput id="amount" name="amount" />

						{errors?.amount && (
							<p className="font-medium text-destructive text-xs">
								{errors.amount[0]}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Label htmlFor="category">Categoria</Label>

						<Select
							name="category"
							onValueChange={setCategory}
							value={category}
						>
							<SelectTrigger className="w-full" id="category">
								<SelectValue placeholder="Selecione uma categoria" />
							</SelectTrigger>

							<SelectContent>
								{EXPENSE_CATEGORIES.map((expenseCategory) => (
									<SelectItem key={expenseCategory} value={expenseCategory}>
										{expenseCategory}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{errors?.category && (
							<p className="font-medium text-destructive text-xs">
								{errors.category[0]}
							</p>
						)}
					</div>

					{category === "Outros" && (
						<div className="space-y-3">
							<Label htmlFor="customCategory">Qual categoria?</Label>

							<Input
								id="customCategory"
								name="customCategory"
								placeholder="Ex.: Uniformes"
							/>
						</div>
					)}

					<div className="space-y-3">
						<Label htmlFor="date">Data</Label>

						<DatePickerInput id="date" name="date" />

						{errors?.date && (
							<p className="font-medium text-destructive text-xs">
								{errors.date[0]}
							</p>
						)}
					</div>

					<Button className="w-full" disabled={isPending} type="submit">
						{isPending ? (
							<span className="flex items-center gap-2">
								<Loader2 className="size-4 animate-spin" />
								Salvando...
							</span>
						) : (
							"Salvar despesa"
						)}
					</Button>
				</form>
			</SheetContent>
		</Sheet>
	);
}
