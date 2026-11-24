"use client";
import { HTTPError } from "ky";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import {
	type FinancialEntry,
	payFinancialEntry,
} from "@/api/http/services/financial-entries";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

const labels = {
	LEGACY: "Sem situação (legado)",
	PENDING: "Pendente",
	PAID: "Pago",
	RECEIVED: "Recebido",
};
export function formatEffectiveDate(day: string | null) {
	return day ? day.split("-").reverse().join("/") : "—";
}
export function PayEntryDialog({
	entry,
	restaurant,
}: {
	entry: FinancialEntry;
	restaurant: string;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [date, setDate] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const sending = useRef(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (sending.current) {
			return;
		}
		if (!date) {
			setError("Informe a data efetiva.");
			return;
		}
		sending.current = true;
		setPending(true);
		setError(null);
		try {
			await payFinancialEntry(restaurant, entry.id, date);
			setOpen(false);
			router.refresh();
		} catch (cause) {
			const detail =
				cause instanceof HTTPError
					? (cause.data as { description?: string; title?: string } | undefined)
					: undefined;
			setError(
				detail?.description ??
					detail?.title ??
					"Não foi possível dar baixa. Confira a data e tente novamente."
			);
		} finally {
			sending.current = false;
			setPending(false);
		}
	}
	return (
		<>
			<Button onClick={() => setOpen(true)} size="sm">
				Dar baixa
			</Button>
			<Dialog
				onOpenChange={(value) => {
					if (!sending.current) {
						setOpen(value);
					}
				}}
				open={open}
			>
				<DialogContent showCloseButton={!pending}>
					<DialogHeader>
						<DialogTitle>Dar baixa</DialogTitle>
						<DialogDescription>
							Informe a data efetiva de{" "}
							{entry.type === "EXPENSE" ? "pagamento" : "recebimento"} de{" "}
							{entry.category}.
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={submit}>
						<fieldset className="space-y-4" disabled={pending}>
							<Label htmlFor={entry.id}>Data efetiva</Label>
							<Input
								id={entry.id}
								name="effectiveDate"
								onChange={(event) => setDate(event.target.value)}
								required
								type="date"
								value={date}
							/>
							{error && (
								<p className="text-destructive" role="alert">
									{error}
								</p>
							)}
							<DialogFooter>
								<Button
									onClick={() => setOpen(false)}
									type="button"
									variant="outline"
								>
									Cancelar
								</Button>
								<Button type="submit">
									{pending ? "Salvando..." : "Confirmar baixa"}
								</Button>
							</DialogFooter>
						</fieldset>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
export function FinancialEntries({
	entries,
	restaurant,
}: {
	entries: FinancialEntry[];
	restaurant: string;
}) {
	return (
		<section aria-label="Lançamentos financeiros" className="space-y-3">
			<h2 className="font-semibold text-lg">Lançamentos financeiros</h2>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Categoria</TableHead>
						<TableHead>Tipo</TableHead>
						<TableHead>Valor</TableHead>
						<TableHead>Situação</TableHead>
						<TableHead>Data efetiva</TableHead>
						<TableHead>Baixa registrada em</TableHead>
						<TableHead>Ações</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{entries.map((entry) => (
						<TableRow key={entry.id}>
							<TableCell>{entry.category}</TableCell>
							<TableCell>
								{entry.type === "EXPENSE" ? "Despesa" : "Receita"}
							</TableCell>
							<TableCell>
								{(entry.amountInCents / 100).toLocaleString("pt-BR", {
									style: "currency",
									currency: "BRL",
								})}
							</TableCell>
							<TableCell>{labels[entry.status]}</TableCell>
							<TableCell>{formatEffectiveDate(entry.settledOn)}</TableCell>
							<TableCell>
								{entry.settledAt
									? new Date(entry.settledAt).toLocaleString("pt-BR", {
											timeZone: "America/Sao_Paulo",
										})
									: "—"}
							</TableCell>
							<TableCell>
								{entry.status === "PENDING" && (
									<PayEntryDialog entry={entry} restaurant={restaurant} />
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			{entries.length === 0 && <p>Nenhum lançamento encontrado.</p>}
		</section>
	);
}
