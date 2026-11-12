/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { PaymentException } from "@/http/_errors/exceptions/payment";
import { TabException } from "@/http/_errors/exceptions/tab";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { ConflictError } from "../_errors/conflict-error";
import { ForbiddenError } from "../_errors/forbidden-error";
import { NotFoundError } from "../_errors/not-found-error";
import { UnprocessableEntityError } from "../_errors/unprocessable-entity-error";

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
						"Checkout: registers the payment (cash, credit/debit card or PIX), closes the tab and sets the table back to FREE in a single transaction. Every item must be DELIVERED or CANCELLED first (409 TAB_HAS_PENDING_ITEMS otherwise). The amount is computed server-side from every non-cancelled item. For CASH, `receivedInCents` is required and must cover the total; the change is computed and stored.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						tabId: z.uuid(),
					}),
					body: z.object({
						method: paymentMethodSchema,
						receivedInCents: z.number().int().positive().optional(),
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
				const { method, receivedInCents } = request.body;

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
						tableId: true,
						items: {
							where: { status: { not: "CANCELLED" } },
							select: { quantity: true, unitPriceInCents: true, status: true },
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

				const amountInCents = tab.items.reduce(
					(total, item) => total + item.quantity * item.unitPriceInCents,
					0
				);

				const isCash = method === "CASH";

				if (isCash && receivedInCents === undefined) {
					throw new BadRequestError(
						"Received amount is required.",
						PaymentException.CASH_RECEIVED_AMOUNT_REQUIRED,
						"Cash payments must inform the amount received from the customer."
					);
				}

				if (isCash && (receivedInCents ?? 0) < amountInCents) {
					throw new UnprocessableEntityError(
						"Insufficient cash amount.",
						PaymentException.INSUFFICIENT_CASH_AMOUNT,
						`The amount received does not cover the total of ${amountInCents} cents.`
					);
				}

				const cashReceived = isCash ? (receivedInCents ?? null) : null;
				const changeInCents =
					cashReceived === null ? null : cashReceived - amountInCents;
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
								items: {
									none: { status: { in: [...PENDING_ITEM_STATUSES] } },
								},
							},
							data: { closedAt },
						});

						if (result.count === 0) {
							throw new ConflictError(
								"Tab could not be closed.",
								TabException.TAB_NOT_OPEN,
								"The tab was closed or received new items before this payment could be recorded."
							);
						}

						const createdPayment = await tx.payment.create({
							data: {
								method,
								amountInCents,
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
