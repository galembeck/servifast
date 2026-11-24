import { createHash } from "node:crypto";
import { type BillSplitInput, splitCheckout } from "@repo/checkout";
import { PaymentException } from "@/http/_errors/exceptions/payment";
import { TabException } from "@/http/_errors/exceptions/tab";
import { ConflictError } from "@/http/routes/_errors/conflict-error";
import { NotFoundError } from "@/http/routes/_errors/not-found-error";
import { UnprocessableEntityError } from "@/http/routes/_errors/unprocessable-entity-error";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { calculatePayment } from "./checkout-payment";
import { decrementStockForSale } from "./stock";

export type SplitRequest = BillSplitInput & {
	requestId: string;
	previewToken?: string;
};
const invoiceInclude = {
	orderBy: { position: "asc" as const },
	include: {
		payment: {
			select: {
				id: true,
				method: true,
				amountInCents: true,
				receivedInCents: true,
				changeInCents: true,
				createdAt: true,
			},
		},
	},
};
export async function readBillSplit(
	db: Pick<PrismaClient, "billSplit">,
	tabId: string,
	restaurantId: string
) {
	const split = await db.billSplit.findFirst({
		where: { tabId, tab: { restaurantId } },
		include: { invoices: invoiceInclude, tab: { select: { closedAt: true } } },
	});
	if (!split) {
		return null;
	}
	const paidInCents = split.invoices.reduce(
		(sum, invoice) => sum + (invoice.payment?.amountInCents ?? 0),
		0
	);
	return {
		...split,
		paidInCents,
		remainingInCents: split.amountInCents - paidInCents,
		closedAt: split.tab.closedAt,
	};
}
async function lockTab(
	tx: Prisma.TransactionClient,
	tabId: string,
	restaurantId: string
) {
	const rows = await tx.$queryRaw<
		{ id: string }[]
	>`SELECT id FROM tabs WHERE id=${tabId} AND restaurant_id=${restaurantId} FOR UPDATE`;
	if (!rows.length) {
		throw new NotFoundError(
			"Comanda não encontrada",
			TabException.TAB_NOT_FOUND
		);
	}
}
async function tabForSplit(
	db: Pick<PrismaClient, "tab">,
	tabId: string,
	restaurantId: string
) {
	const tab = await db.tab.findUnique({
		where: { id: tabId, restaurantId },
		include: {
			items: {
				where: { status: { not: "CANCELLED" } },
				orderBy: { id: "asc" },
			},
		},
	});
	if (!tab) {
		throw new NotFoundError(
			"Comanda não encontrada",
			TabException.TAB_NOT_FOUND
		);
	}
	if (tab.closedAt) {
		throw new ConflictError("Comanda encerrada", TabException.TAB_NOT_OPEN);
	}
	if (tab.items.some((item) => item.status !== "DELIVERED")) {
		throw new ConflictError(
			"Há itens não entregues",
			TabException.TAB_HAS_PENDING_ITEMS
		);
	}
	return tab;
}
function plan(items: Parameters<typeof splitCheckout>[0], input: SplitRequest) {
	try {
		const { requestId, previewToken, ...division } = input;
		const preview = splitCheckout(items, division);
		const fingerprint = createHash("sha256")
			.update(
				JSON.stringify({
					items: items.map(({ id, quantity, unitPriceInCents }) => ({
						id,
						quantity,
						unitPriceInCents,
					})),
					division,
				})
			)
			.digest("hex");
		return { ...preview, fingerprint };
	} catch (error) {
		throw new UnprocessableEntityError(
			"Divisão inválida",
			PaymentException.INVALID_SPLIT,
			error instanceof RangeError
				? error.message
				: "Confira a distribuição dos itens."
		);
	}
}
export async function previewBillSplit(
	db: PrismaClient,
	tabId: string,
	restaurantId: string,
	input: SplitRequest
) {
	const tab = await tabForSplit(db, tabId, restaurantId);
	if (await db.billSplit.findUnique({ where: { tabId } })) {
		throw new ConflictError(
			"Conta já dividida",
			PaymentException.BILL_SPLIT_LOCKED
		);
	}
	return plan(tab.items, input);
}
export function createBillSplit(
	db: PrismaClient,
	tabId: string,
	restaurantId: string,
	input: SplitRequest
) {
	return db.$transaction(
		async (tx) => {
			await lockTab(tx, tabId, restaurantId);
			const existing = await readBillSplit(tx, tabId, restaurantId);
			if (existing) {
				if (
					existing.requestId === input.requestId &&
					existing.fingerprint === input.previewToken
				) {
					const frozen = await tx.tab.findUniqueOrThrow({
						where: { id: tabId },
						include: {
							items: {
								where: { status: { not: "CANCELLED" } },
								orderBy: { id: "asc" },
							},
						},
					});
					if (plan(frozen.items, input).fingerprint !== existing.fingerprint) {
						throw new ConflictError(
							"Conta já dividida",
							PaymentException.BILL_SPLIT_LOCKED
						);
					}
					return existing;
				}
				throw new ConflictError(
					"Conta já dividida",
					PaymentException.BILL_SPLIT_LOCKED
				);
			}
			const tab = await tabForSplit(tx, tabId, restaurantId);
			const preview = plan(tab.items, input);
			if (input.previewToken !== preview.fingerprint) {
				throw new ConflictError(
					"A conta mudou",
					PaymentException.SPLIT_CHANGED,
					"Recalcule a prévia antes de confirmar."
				);
			}
			if (await tx.payment.count({ where: { tabId } })) {
				throw new ConflictError(
					"Comanda já tem pagamento",
					PaymentException.BILL_SPLIT_LOCKED
				);
			}
			await tx.billSplit.create({
				data: {
					tabId,
					requestId: input.requestId,
					fingerprint: preview.fingerprint,
					mode: input.mode,
					...preview.totals,
					adjustments: {
						...(input.serviceFee ? { serviceFee: input.serviceFee } : {}),
						...(input.discount ? { discount: input.discount } : {}),
					},
					invoices: {
						create: preview.parts.map((part) => ({
							...part,
							items: part.items,
						})),
					},
				},
			});
			return readBillSplit(tx, tabId, restaurantId);
		},
		{ timeout: 15_000 }
	);
}
export function payBillInvoice(
	db: PrismaClient,
	tabId: string,
	restaurantId: string,
	invoiceId: string,
	userId: string,
	input: {
		method: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "PIX";
		receivedInCents?: number;
	}
) {
	const cash = input.method === "CASH" ? (input.receivedInCents ?? null) : null;
	return db.$transaction(
		async (tx) => {
			await lockTab(tx, tabId, restaurantId);
			const split = await readBillSplit(tx, tabId, restaurantId);
			const invoice = split?.invoices.find((part) => part.id === invoiceId);
			if (!(split && invoice)) {
				throw new NotFoundError(
					"Parcela não encontrada",
					TabException.TAB_NOT_FOUND
				);
			}

			if (invoice.payment) {
				if (
					invoice.payment.method !== input.method ||
					invoice.payment.receivedInCents !== cash
				) {
					throw new ConflictError(
						"Parcela já paga",
						PaymentException.INVOICE_ALREADY_PAID
					);
				}
				return split;
			}
			const tab = await tx.tab.findUniqueOrThrow({
				where: { id: tabId },
				include: { items: { where: { status: { not: "CANCELLED" } } } },
			});
			if (tab.closedAt) {
				throw new ConflictError("Comanda encerrada", TabException.TAB_NOT_OPEN);
			}
			const payment = calculatePayment(
				[{ quantity: 1, unitPriceInCents: invoice.amountInCents }],
				input
			);
			// The first receipt debits/reserves ALL delivered units, atomically with
			// payment. A shortage rolls it all back. Later invoices never debit again,
			// so an intervening stock change cannot strand money already received.
			if (!tab.stockDebitedAt) {
				await decrementStockForSale(tx, tab.items);
				await tx.tab.update({
					where: { id: tabId },
					data: { stockDebitedAt: new Date() },
				});
			}
			await tx.payment.create({
				data: {
					tabId,
					restaurantId,
					invoiceId,
					paidById: userId,
					method: input.method,
					amountInCents: invoice.amountInCents,
					subtotalInCents: invoice.subtotalInCents ?? invoice.amountInCents,
					serviceFeeInCents: invoice.serviceFeeInCents ?? 0,
					discountInCents: invoice.discountInCents ?? 0,
					adjustments: { splitId: split.id },
					receivedInCents: payment.cashReceived,
					changeInCents: payment.changeInCents,
				},
			});
			const pending = await tx.partialInvoice.count({
				where: { splitId: split.id, payment: { is: null } },
			});
			if (pending === 0) {
				await tx.tab.update({
					where: { id: tabId },
					data: { closedAt: new Date() },
				});
				await tx.table.update({
					where: { id: tab.tableId },
					data: { status: "FREE", occupiedSeats: 0 },
				});
			}
			return readBillSplit(tx, tabId, restaurantId);
		},
		{ timeout: 15_000 }
	);
}

export async function assertUnsplitTab(
	db: Pick<PrismaClient, "billSplit">,
	tabId: string,
	restaurantId: string
) {
	if (
		await db.billSplit.findFirst({
			where: { tabId, tab: { restaurantId } },
			select: { id: true },
		})
	) {
		throw new ConflictError(
			"Conta dividida",
			PaymentException.BILL_SPLIT_LOCKED,
			"Os itens e ajustes desta divisão estão bloqueados."
		);
	}
}
