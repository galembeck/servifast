"use client";
import type { CheckoutAdjustments } from "@repo/checkout";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type {
	SplitPreview,
	SplitRequest,
} from "@/api/http/services/bill-split";
import type { TabItem } from "@/api/http/services/get-tab";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "../../../dashboard/~components/format";
import { createSplitAction, previewSplitAction } from "../~actions/actions";
export function SplitBillBuilder({
	tabId,
	restaurant,
	items,
	adjustments,
	disabled,
	onCreated,
}: {
	tabId: string;
	restaurant: string;
	items: TabItem[];
	adjustments: CheckoutAdjustments;
	disabled: boolean;
	onCreated: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<"PEOPLE" | "ITEMS">("PEOPLE");
	const [people, setPeople] = useState(2);
	const [units, setUnits] = useState<Record<string, number>>({});
	const [preview, setPreview] = useState<SplitPreview | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const sending = useRef(false);
	const requestId = useRef<string | null>(null);
	const query = useQueryClient();
	const router = useRouter();
	const eligible = items.filter((item) => item.status !== "CANCELLED");
	function input(): SplitRequest {
		requestId.current ??= crypto.randomUUID();
		const common = { ...adjustments, requestId: requestId.current };
		if (mode === "PEOPLE") {
			return { ...common, mode, people };
		}
		return {
			...common,
			mode,
			clients: Array.from({ length: people }, (_, index) => index).map((i) => ({
				name: `Pessoa ${i + 1}`,
				items: eligible
					.map((item) => ({
						itemId: item.id,
						quantity: units[`${item.id}:${i}`] ?? 0,
					}))
					.filter((part) => part.quantity > 0),
			})),
		};
	}
	async function calculate() {
		if (sending.current) {
			return;
		}
		sending.current = true;
		setBusy(true);
		setError(null);
		try {
			const result = await previewSplitAction(tabId, input());
			if (!result.success) {
				setError(result.title);
				return;
			}
			setPreview(result.preview);
		} finally {
			sending.current = false;
			setBusy(false);
		}
	}
	async function confirm() {
		if (sending.current || !preview) {
			return;
		}
		sending.current = true;
		setBusy(true);
		setError(null);
		try {
			const result = await createSplitAction(tabId, {
				...input(),
				previewToken: preview.fingerprint,
			});
			if (!result.success) {
				setError(result.title);
				setPreview(null);
				return;
			}
			query.setQueryData(["bill-split", restaurant, tabId], {
				split: result.split,
			});
			await query.invalidateQueries({
				queryKey: ["restaurants", restaurant, "tabs", tabId],
			});
			setOpen(false);
			onCreated();
			router.refresh();
		} finally {
			sending.current = false;
			setBusy(false);
		}
	}
	return (
		<Dialog
			onOpenChange={(value) => {
				if (sending.current) {
					return;
				}
				setOpen(value);
				if (!value) {
					setPreview(null);
					setError(null);
					requestId.current = null;
				}
			}}
			open={open}
		>
			<DialogTrigger asChild>
				<Button disabled={disabled} type="button" variant="outline">
					Dividir conta
				</Button>
			</DialogTrigger>
			<DialogContent
				className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
				showCloseButton={!busy}
			>
				<DialogHeader>
					<DialogTitle>Dividir conta</DialogTitle>
					<DialogDescription>
						Confira a prévia antes de confirmar. Depois, os itens e ajustes
						ficam bloqueados. A mesa será liberada quando todas as parcelas
						forem pagas.
					</DialogDescription>
				</DialogHeader>
				<fieldset className="space-y-4" disabled={busy}>
					<Label htmlFor="split-mode">Modo de divisão</Label>
					<select
						className="rounded-md border bg-background p-2"
						id="split-mode"
						onChange={(e) => {
							setMode(e.target.value as "PEOPLE" | "ITEMS");
							setPreview(null);
						}}
						value={mode}
					>
						<option value="PEOPLE">Por pessoas</option>
						<option value="ITEMS">Por itens</option>
					</select>
					<Label htmlFor="split-people">Número de pessoas</Label>
					<Input
						id="split-people"
						max={100}
						min={2}
						onChange={(e) => {
							setPeople(Number(e.target.value));
							setPreview(null);
						}}
						type="number"
						value={people}
					/>
					{mode === "ITEMS" &&
						Number.isInteger(people) &&
						people >= 2 &&
						people <= 100 && (
							<div className="space-y-4">
								{eligible.map((item) => (
									<fieldset
										className="space-y-2 rounded border p-2"
										key={item.id}
									>
										<legend>
											{item.quantity} × {item.menuItem.name}
										</legend>
										<div className="grid grid-cols-2 gap-2">
											{Array.from({ length: people }, (_, i) => (
												// biome-ignore lint/suspicious/noArrayIndexKey: participants have fixed numbered slots
												<div key={i}>
													<Label htmlFor={`${item.id}:${i}`}>
														Pessoa {i + 1}
													</Label>
													<Input
														aria-label={`Unidades de ${item.menuItem.name} para Pessoa ${i + 1}`}
														id={`${item.id}:${i}`}
														max={item.quantity}
														min={0}
														onChange={(e) => {
															setUnits({
																...units,
																[`${item.id}:${i}`]: Number(e.target.value),
															});
															setPreview(null);
														}}
														type="number"
														value={units[`${item.id}:${i}`] ?? 0}
													/>
												</div>
											))}
										</div>
									</fieldset>
								))}
							</div>
						)}
					<Button onClick={calculate} type="button" variant="outline">
						{busy ? "Calculando..." : "Calcular prévia"}
					</Button>
					{error && (
						<p className="text-destructive" role="alert">
							{error}
						</p>
					)}
					{preview && (
						<section aria-label="Prévia da divisão" className="space-y-2">
							<p>
								Subtotal: {formatPrice(preview.totals.subtotalInCents)} · Taxa:{" "}
								{formatPrice(preview.totals.serviceFeeInCents)} · Desconto:{" "}
								{formatPrice(preview.totals.discountInCents)}
							</p>
							{preview.parts.map((part) => (
								<div className="flex justify-between" key={part.position}>
									<span>{part.name}</span>
									<span>{formatPrice(part.amountInCents)}</span>
								</div>
							))}
							<p className="font-semibold">
								Total: {formatPrice(preview.totals.amountInCents)}
							</p>
						</section>
					)}
					<DialogFooter>
						<Button
							onClick={() => setOpen(false)}
							type="button"
							variant="outline"
						>
							Cancelar
						</Button>
						<Button disabled={!preview} onClick={confirm} type="button">
							{busy ? "Salvando..." : "Confirmar divisão"}
						</Button>
					</DialogFooter>
				</fieldset>
			</DialogContent>
		</Dialog>
	);
}
