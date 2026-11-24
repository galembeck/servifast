/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { MAX_PAYMENT_IN_CENTS } from "@repo/checkout";
import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { PaymentException } from "@/http/_errors/exceptions/payment";
import { TabException } from "@/http/_errors/exceptions/tab";
import { auth } from "@/http/middlewares/auth";
import { calculatePayment } from "@/lib/checkout-payment";
import { prisma } from "@/lib/prisma";
import { decrementStockForSale } from "@/lib/stock";
import { ConflictError } from "../_errors/conflict-error";
import { ForbiddenError } from "../_errors/forbidden-error";
import { NotFoundError } from "../_errors/not-found-error";

const adjustmentSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("FIXED"),
		amountInCents: z.number().int().min(0).max(MAX_PAYMENT_IN_CENTS),
	}),
	z.object({
		type: z.literal("PERCENT"),
		basisPoints: z.number().int().min(0).max(10_000),
	}),
]);

const paymentMethodSchema = z.enum([
	"CASH",
	"CREDIT_CARD",
	"DEBIT_CARD",
	"PIX",
]);

/** Items still on their way to the table: not delivered and not cancelled. */
const PENDING_ITEM_STATUSES = ["RECEIVED", "PREPARING", "READY"] as const;

export async function closeTabRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/tabs/:tabId/close",
			{
				schema: {
					tags: ["Tabs"],
					summary: "/restaurants/:slug/tabs/:tabId/close",
					description:
						'Checkout: registers the payment (cash, credit/debit card or PIX), closes the tab and sets the table back to FREE in a single transaction. Every item must be DELIVERED or CANCELLED first (409 TAB_HAS_PENDING_ITEMS otherwise). Closing decrements the stock of every tracked product 1:1 with the units sold; if any product lacks stock, nothing is recorded and it returns 409 INSUFFICIENT_STOCK (description lists the shortages, e.g. "Chopp ×1"). The subtotal is computed server-side from every non-cancelled item. Optional serviceFee/discount accept FIXED amountInCents or PERCENT basisPoints (10% = 1000), both based on the subtotal and rounded half up. The adjusted total and calculation snapshot are stored on the payment; negative totals are rejected. For CASH, `receivedInCents` is required and must cover the total; the change is computed and stored.',
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						tabId: z.uuid(),
					}),
					body: z.object({
						method: paymentMethodSchema,
						receivedInCents: z
							.number()
							.int()
							.min(0)
							.max(MAX_PAYMENT_IN_CENTS)
							.optional(),
						serviceFee: adjustmentSchema.optional(),
						discount: adjustmentSchema.optional(),
					}),
					response: {
						200: z.object({
							payment: z.object({
								id: z.uuid(),
								method: paymentMethodSchema,
								amountInCents: z.number(),
								receivedInCents: z.number().nullable(),
								changeInCents: z.number().nullable(),
								createdAt: z.date(),
							}),
							tab: z.object({
								id: z.uuid(),
								closedAt: z.date(),
							}),
							table: z.object({
								id: z.uuid(),
								status: z.literal("FREE"),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug, tabId } = request.params;
				const { method, serviceFee, discount } = request.body;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("close", "Order")) {
					throw new ForbiddenError(
						"You are not authorized to close tabs.",
						AuthException.FORBIDDEN,
						"Only cashiers, managers and owners can close tabs."
					);
				}

				const tab = await prisma.tab.findUnique({
					where: { id: tabId, restaurantId: restaurant.id },
					select: {
						closedAt: true,
						split: { select: { id: true } },
						tableId: true,
						items: {
							where: { status: { not: "CANCELLED" } },
							select: {
								menuItemId: true,
								quantity: true,
								unitPriceInCents: true,
								status: true,
							},
						},
					},
				});

				if (!tab) {
					throw new NotFoundError(
						"Tab not found.",
						TabException.TAB_NOT_FOUND,
						"The tab with the specified ID was not found in this restaurant."
					);
				}

				if (tab.split) {
					throw new ConflictError(
						"Conta dividida",
						PaymentException.BILL_SPLIT_LOCKED,
						"Pague as parcelas da divisão existente."
					);
				}

				if (tab.closedAt !== null) {
					throw new ConflictError(
						"Tab is not open.",
						TabException.TAB_NOT_OPEN,
						"This tab has already been closed."
					);
				}

				const pendingItemsCount = tab.items.filter(
					(item) => item.status !== "DELIVERED"
				).length;

				if (pendingItemsCount > 0) {
					throw new ConflictError(
						"Tab has pending items.",
						TabException.TAB_HAS_PENDING_ITEMS,
						`${pendingItemsCount} item(s) were not delivered yet. Deliver or cancel them before closing the tab.`
					);
				}

				const { totals, cashReceived, changeInCents } = calculatePayment(
					tab.items,
					request.body
				);
				const closedAt = new Date();

				const payment = await prisma.$transaction(
					// biome-ignore lint/suspicious/noExplicitAny: tx type requires generated Prisma client (run db:generate)
					async (tx: any) => {
						// Conditional update: closes nothing (and rolls back) if the tab was
						// closed concurrently or got a pending item after it was read.
						const result = await tx.tab.updateMany({
							where: {
								id: tabId,
								closedAt: null,
								split: { is: null },
								items: {
									none: { status: { in: [...PENDING_ITEM_STATUSES] } },
								},
							},
							data: { closedAt, stockDebitedAt: closedAt },
						});

						if (result.count === 0) {
							throw new ConflictError(
								"Tab could not be closed.",
								TabException.TAB_NOT_OPEN,
								"The tab was closed or received new items before this payment could be recorded."
							);
						}

						// RN01/RN02: the closing event decrements the stock 1:1. Throws
						// 409 INSUFFICIENT_STOCK (rolling everything back) when short.
						await decrementStockForSale(tx, tab.items);

						const createdPayment = await tx.payment.create({
							data: {
								method,
								...totals,
								adjustments: {
									...(serviceFee ? { serviceFee } : {}),
									...(discount ? { discount } : {}),
								},
								receivedInCents: cashReceived,
								changeInCents,
								tabId,
								paidById: userId,
								restaurantId: restaurant.id,
							},
							select: {
								id: true,
								method: true,
								amountInCents: true,
								receivedInCents: true,
								changeInCents: true,
								createdAt: true,
							},
						});

						await tx.table.update({
							where: { id: tab.tableId },
							data: { status: "FREE", occupiedSeats: 0 },
						});

						return createdPayment;
					}
				);

				return {
					payment,
					tab: { id: tabId, closedAt },
					table: { id: tab.tableId, status: "FREE" as const },
				};
			}
		);
}
