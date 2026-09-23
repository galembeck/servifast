"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerInputProps {
	defaultValue?: string;
	id?: string;
	name: string;
}

function parseIsoDate(isoDate: string | undefined) {
	const [year, month, day] = (isoDate ?? "").split("-").map(Number);

	if (!(year && month && day)) {
		return;
	}

	return new Date(year, month - 1, day);
}

function toIsoDate(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

export function DatePickerInput({
	name,
	id,
	defaultValue,
}: DatePickerInputProps) {
	const [date, setDate] = useState<Date | undefined>(() =>
		parseIsoDate(defaultValue)
	);
	const [open, setOpen] = useState(false);

	return (
		<>
			<input name={name} type="hidden" value={date ? toIsoDate(date) : ""} />

			<Popover onOpenChange={setOpen} open={open}>
				<PopoverTrigger asChild>
					<Button
						className={cn(
							"w-full justify-start font-normal",
							!date && "text-muted-foreground"
						)}
						id={id}
						type="button"
						variant="outline"
					>
						<CalendarIcon className="mr-2 size-4" />
						{date
							? format(date, "dd/MM/yyyy", { locale: ptBR })
							: "Selecione uma data"}
					</Button>
				</PopoverTrigger>

				<PopoverContent align="start" className="w-auto p-0">
					<Calendar
						locale={ptBR}
						mode="single"
						onSelect={(selectedDate) => {
							setDate(selectedDate);
							setOpen(false);
						}}
						selected={date}
					/>
				</PopoverContent>
			</Popover>
		</>
	);
}
