import { randomUUID } from "node:crypto";
import {
	type CheckoutAdjustments,
	calculateCheckoutTotals,
} from "@repo/checkout";
import { PaymentException } from "@/http/_errors/exceptions/payment";
import { TabException } from "@/http/_errors/exceptions/tab";
import { ConflictError } from "@/http/routes/_errors/conflict-error";
import { UnprocessableEntityError } from "@/http/routes/_errors/unprocessable-entity-error";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import {
	lockTab,
	payLockedInvoice,
	readBillSplit,
	tabForSplit,
} from "./bill-split";
import { calculatePayment } from "./checkout-payment";

export type PartialPaymentInput = CheckoutAdjustments & {
	requestId: string;
	amountInCents: number;
	method: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "PIX";
	receivedInCents?: number;
};
function locked() {
	return new ConflictError(
		"Conta bloqueada",
		PaymentException.BILL_SPLIT_LOCKED,
		"Os itens e ajustes foram fixados pelo primeiro pagamento. Não é possível combinar pagamento parcial e divisão."
	);
}
function invalid() {
	return new UnprocessableEntityError(
		"Valor parcial inválido",
		PaymentException.INVALID_PARTIAL_PAYMENT,
		"Informe um valor positivo menor que o saldo restante. Para quitar o saldo, use Fechar conta."
	);
}
type State = NonNullable<Awaited<ReturnType<typeof readBillSplit>>>;
type RecordInput = Omit<PartialPaymentInput, "amountInCents"> & {
	amountInCents?: number;
};
function validateSnapshot(state: State | null, input: RecordInput) {
	if (!state) {
		return;
	}
	if (state.mode !== "PARTIAL") {
		throw locked();
	}
	if (!(input.serviceFee || input.discount)) {
		return;
	}
	const totals = calculateCheckoutTotals(state.subtotalInCents, input);
	if (
		totals.serviceFeeInCents !== state.serviceFeeInCents ||
		totals.discountInCents !== state.discountInCents
	) {
		throw locked();
	}
}
function validateReplay(
	replay: State["invoices"][number],
	input: RecordInput,
	settle: boolean
) {
	if (
		(!settle && replay.amountInCents !== input.amountInCents) ||
		replay.name !== (settle ? "Quitação" : "Pagamento parcial")
	) {
		throw new ConflictError(
			"Requisição já utilizada",
			PaymentException.PAYMENT_REQUEST_CONFLICT
		);
	}
}
function paymentAmount(
	requested: number | undefined,
	remaining: number,
	settle: boolean
) {
	const amount = settle ? remaining : requested;
	if (
		amount === undefined ||
		!Number.isInteger(amount) ||
		amount <= 0 ||
		(!settle && amount >= remaining)
	) {
		throw invalid();
	}
	return amount;
}
async function createSnapshot(
	tx: Prisma.TransactionClient,
	tabId: string,
	restaurantId: string,
	input: RecordInput,
	totals: ReturnType<typeof calculateCheckoutTotals>,
	settle: boolean
) {
	if (settle || (await tx.payment.count({ where: { tabId } }))) {
		throw locked();
	}
	await tx.billSplit.create({
		data: {
			tabId,
			requestId: input.requestId,
			fingerprint: "PARTIAL",
			mode: "PARTIAL",
			...totals,
			adjustments: {
				...(input.serviceFee ? { serviceFee: input.serviceFee } : {}),
				...(input.discount ? { discount: input.discount } : {}),
			},
		},
	});
	const state = await readBillSplit(tx, tabId, restaurantId);
	if (!state) {
		throw new Error("Missing partial checkout snapshot");
	}
	return state;
}
/** The tab row serializes partial receipts, final settlement and split creation. */
function record(
	db: PrismaClient,
	tabId: string,
	restaurantId: string,
	userId: string,
	input: Omit<PartialPaymentInput, "amountInCents"> & {
		amountInCents?: number;
	},
	settle: boolean
) {
	return db.$transaction(
		async (tx) => {
			await lockTab(tx, tabId, restaurantId);
			let state = await readBillSplit(tx, tabId, restaurantId);
			validateSnapshot(state, input);
			const replay = state?.invoices.find((i) => i.id === input.requestId);
			if (replay) {
				validateReplay(replay, input, settle);
				return payLockedInvoice(
					tx,
					tabId,
					restaurantId,
					replay.id,
					userId,
					input,
					true
				);
			}
			if (state?.closedAt) {
				throw new ConflictError("Comanda encerrada", TabException.TAB_NOT_OPEN);
			}
			const tab = await tabForSplit(tx, tabId, restaurantId);
			const totals =
				state ??
				calculatePayment(tab.items, { ...input, method: "PIX" }).totals;
			const remaining = state?.remainingInCents ?? totals.amountInCents;
			const amount = paymentAmount(input.amountInCents, remaining, settle);
			state =
				state ??
				(await createSnapshot(tx, tabId, restaurantId, input, totals, settle));
			await tx.partialInvoice.create({
				data: {
					id: input.requestId,
					splitId: state.id,
					position: state.invoices.length + 1,
					name: settle ? "Quitação" : "Pagamento parcial",
					amountInCents: amount,
					subtotalInCents: amount,
					serviceFeeInCents: 0,
					discountInCents: 0,
					items: [],
				},
			});
			return payLockedInvoice(
				tx,
				tabId,
				restaurantId,
				input.requestId,
				userId,
				input,
				true
			);
		},
		{ timeout: 15_000 }
	);
}
export function registerPartialPayment(
	db: PrismaClient,
	tabId: string,
	restaurantId: string,
	userId: string,
	input: PartialPaymentInput
) {
	return record(db, tabId, restaurantId, userId, input, false);
}
export async function settlePartialTab(
	db: PrismaClient,
	tabId: string,
	restaurantId: string,
	userId: string,
	input: CheckoutAdjustments & {
		requestId?: string;
		method: PartialPaymentInput["method"];
		receivedInCents?: number;
	}
) {
	const requestId = input.requestId ?? randomUUID();
	const state = await record(
		db,
		tabId,
		restaurantId,
		userId,
		{ ...input, requestId },
		true
	);
	const payment = state?.invoices.find((i) => i.id === requestId)?.payment;
	const tab = await db.tab.findUniqueOrThrow({
		where: { id: tabId },
		select: { tableId: true },
	});
	if (!(payment && state?.closedAt)) {
		throw new Error("Missing settlement");
	}
	return {
		payment,
		tab: { id: tabId, closedAt: state.closedAt },
		table: { id: tab.tableId, status: "FREE" as const },
	};
}
