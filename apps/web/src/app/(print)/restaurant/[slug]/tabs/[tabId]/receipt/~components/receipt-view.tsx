"use client";

import { Printer } from "lucide-react";
import { useState } from "react";
import type { PaymentMethod } from "@/api/http/services/close-tab";
import type { TabReceipt } from "@/api/http/services/get-tab-receipt";
import { Button } from "@/components/ui/button";

type PaperWidth = 58 | 80;

const PAPER_WIDTHS: PaperWidth[] = [58, 80];

/** Printable area inside the paper margins, per thermal paper width (mm). */
const PRINTABLE_WIDTH_IN_MM: Record<PaperWidth, number> = { 58: 48, 80: 72 };
const FONT_SIZE_IN_PX: Record<PaperWidth, number> = { 58: 11, 80: 12 };

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
	CASH: "Dinheiro",
	CREDIT_CARD: "Cartão de crédito",
	DEBIT_CARD: "Cartão de débito",
	PIX: "PIX",
};

const CENTS_PER_REAL = 100;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

function formatPrice(priceInCents: number) {
	return currencyFormatter.format(priceInCents / CENTS_PER_REAL);
}

function formatDateTime(value: string | Date) {
	return dateTimeFormatter.format(new Date(value));
}

function Row({
	label,
	value,
	bold = false,
}: {
	bold?: boolean;
	label: string;
	value: string;
}) {
	return (
		<div className={`flex justify-between gap-2 ${bold ? "font-bold" : ""}`}>
			<span>{label}</span>
			<span className="whitespace-nowrap">{value}</span>
		</div>
	);
}

function Divider() {
	return <hr className="my-1.5 border-black border-t border-dashed" />;
}

interface ReceiptViewProps {
	receipt: TabReceipt;
}

/**
 * Non-fiscal receipt laid out for 58 mm / 80 mm thermal printers. On screen
 * it shows a paper-width preview with a toolbar; when printing only the
 * receipt is output, in black on white with no page margins.
 */
export function ReceiptView({ receipt }: ReceiptViewProps) {
	const [paperWidth, setPaperWidth] = useState<PaperWidth>(80);
	const [issuedAt] = useState(() => new Date());
	const { payment, tab } = receipt;

	return (
		<main className="flex flex-1 flex-col items-center gap-4 bg-muted/40 p-4 print:block print:bg-white print:p-0">
			<style>{`
				@page { size: ${paperWidth}mm auto; margin: 0; }
				@media print {
					html, body { background: #fff !important; color: #000 !important; }
				}
			`}</style>

			<div className="flex flex-wrap items-center gap-2 print:hidden">
				<fieldset className="flex items-center gap-1 rounded-md border p-1">
					<legend className="sr-only">Largura do papel</legend>
					{PAPER_WIDTHS.map((width) => (
						<Button
							aria-pressed={paperWidth === width}
							key={width}
							onClick={() => setPaperWidth(width)}
							size="sm"
							type="button"
							variant={paperWidth === width ? "default" : "ghost"}
						>
							{width} mm
						</Button>
					))}
				</fieldset>

				<Button onClick={() => window.print()} type="button">
					<Printer className="mr-2 size-4" />
					Imprimir
				</Button>
			</div>

			<article
				className="bg-white font-mono text-black leading-snug shadow-md print:shadow-none"
				style={{
					width: `${PRINTABLE_WIDTH_IN_MM[paperWidth]}mm`,
					fontSize: `${FONT_SIZE_IN_PX[paperWidth]}px`,
					boxSizing: "content-box",
					padding: `4mm ${(paperWidth - PRINTABLE_WIDTH_IN_MM[paperWidth]) / 2}mm`,
				}}
			>
				<header className="text-center">
					<p className="font-bold text-[1.2em] uppercase">
						{receipt.restaurant.name}
					</p>
					<p className="font-bold">COMPROVANTE NÃO FISCAL</p>
					<p>Nº {receipt.code}</p>
				</header>

				<Divider />

				<Row
					label={`Mesa ${receipt.table.number}`}
					value={tab.customerName ?? ""}
				/>
				{tab.peopleCount !== null && (
					<Row label="Pessoas" value={String(tab.peopleCount)} />
				)}
				<Row label="Abertura" value={formatDateTime(tab.openedAt)} />
				<Row label="Fechamento" value={formatDateTime(tab.closedAt)} />

				<Divider />

				<ul>
					{receipt.items.map((line) => (
						<li
							className="py-0.5"
							key={`${line.menuItemId}:${line.unitPriceInCents}`}
						>
							<p className="break-words">
								{line.quantity}× {line.name}
							</p>
							<Row
								label={`  ${formatPrice(line.unitPriceInCents)} un.`}
								value={formatPrice(line.totalInCents)}
							/>
						</li>
					))}
				</ul>

				<Divider />

				<Row label="Subtotal" value={formatPrice(receipt.subtotalInCents)} />
				<Row bold label="TOTAL" value={formatPrice(payment.amountInCents)} />

				<Divider />

				<Row label="Pagamento" value={PAYMENT_METHOD_LABEL[payment.method]} />
				{payment.receivedInCents !== null && (
					<Row label="Recebido" value={formatPrice(payment.receivedInCents)} />
				)}
				{payment.changeInCents !== null && (
					<Row label="Troco" value={formatPrice(payment.changeInCents)} />
				)}

				<Divider />

				{payment.cashierName && (
					<Row label="Caixa" value={payment.cashierName} />
				)}
				<Row label="Emitido em" value={formatDateTime(issuedAt)} />

				<footer className="mt-2 text-center">
					<p>Este documento não tem valor fiscal.</p>
					<p>Obrigado pela preferência!</p>
				</footer>
			</article>
		</main>
	);
}
