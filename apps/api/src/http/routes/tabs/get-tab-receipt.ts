/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { TabException } from "@/http/_errors/exceptions/tab";
import { auth } from "@/http/middlewares/auth";
import { groupBillItems } from "@/lib/bill";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "../_errors/conflict-error";
import { ForbiddenError } from "../_errors/forbidden-error";
import { NotFoundError } from "../_errors/not-found-error";

/** Short human-readable receipt code, derived from the payment id. */
const RECEIPT_CODE_LENGTH = 8;
const receiptPaymentSchema = z.object({
	id: z.uuid(),
	method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "PIX"]),
	amountInCents: z.number(),
	receivedInCents: z.number().nullable(),
	changeInCents: z.number().nullable(),
	paidAt: z.date(),
	cashierName: z.string().nullable(),
	invoiceName: z.string().nullable(),
	invoicePosition: z.number().nullable(),
});

export async function getTabReceiptRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/tabs/:tabId/receipt",
			{
				schema: {
					tags: ["Tabs"],
					summary: "/restaurants/:slug/tabs/:tabId/receipt",
					description:
						"Structured data of a non-fiscal receipt for a closed (paid) tab, ready to be rendered for 58 mm/80 mm thermal printers. Open tabs have no receipt yet (409 TAB_NOT_CLOSED).",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						tabId: z.uuid(),
					}),
					response: {
						200: z.object({
							receipt: z.object({
								code: z.string(),
								restaurant: z.object({ name: z.string() }),
								table: z.object({ number: z.number() }),
								tab: z.object({
									customerName: z.string().nullable(),
									peopleCount: z.number().nullable(),
									openedAt: z.date(),
									closedAt: z.date(),
								}),
								items: z.array(
									z.object({
										menuItemId: z.uuid(),
										name: z.string(),
										quantity: z.number(),
										unitPriceInCents: z.number(),
										totalInCents: z.number(),
									})
								),
								subtotalInCents: z.number(),
								serviceFeeInCents: z.number(),
								discountInCents: z.number(),
								payment: receiptPaymentSchema.nullable(),
								payments: z.array(receiptPaymentSchema),
								totalInCents: z.number(),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug, tabId } = request.params;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("close", "Order")) {
					throw new ForbiddenError(
						"You are not authorized to issue receipts.",
						AuthException.FORBIDDEN,
						"Only cashiers, managers and owners can issue receipts."
					);
				}

				const tab = await prisma.tab.findUnique({
					where: { id: tabId, restaurantId: restaurant.id },
					select: {
						customerName: true,
						peopleCount: true,
						openedAt: true,
						closedAt: true,
						table: { select: { number: true } },
						items: {
							where: { status: { not: "CANCELLED" } },
							orderBy: { createdAt: "asc" },
							select: {
								quantity: true,
								unitPriceInCents: true,
								menuItem: { select: { id: true, name: true } },
							},
						},
						split: {
							select: {
								subtotalInCents: true,
								serviceFeeInCents: true,
								discountInCents: true,
								amountInCents: true,
							},
						},
						payments: {
							orderBy: [{ createdAt: "asc" }, { id: "asc" }],
							select: {
								id: true,
								method: true,
								amountInCents: true,
								subtotalInCents: true,
								serviceFeeInCents: true,
								discountInCents: true,
								receivedInCents: true,
								changeInCents: true,
								createdAt: true,
								paidBy: { select: { name: true } },
								invoice: { select: { name: true, position: true } },
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

				const { closedAt, payments } = tab;
				const payment = payments[0];

				if (closedAt === null || !payment) {
					throw new ConflictError(
						"Tab is not closed.",
						TabException.TAB_NOT_CLOSED,
						"A receipt is only available after the tab is closed and paid."
					);
				}

				const { lines, subtotalInCents } = groupBillItems(tab.items);
				const receiptPayments = payments.map((p) => ({
					id: p.id,
					method: p.method,
					amountInCents: p.amountInCents,
					receivedInCents: p.receivedInCents,
					changeInCents: p.changeInCents,
					paidAt: p.createdAt,
					cashierName: p.paidBy.name,
					invoiceName: p.invoice?.name ?? null,
					invoicePosition: p.invoice?.position ?? null,
				}));

				return {
					receipt: {
						code: payment.id.slice(0, RECEIPT_CODE_LENGTH).toUpperCase(),
						restaurant: { name: restaurant.name },
						table: tab.table,
						tab: {
							customerName: tab.customerName,
							peopleCount: tab.peopleCount,
							openedAt: tab.openedAt,
							closedAt,
						},
						items: lines,
						subtotalInCents:
							tab.split?.subtotalInCents ??
							payment.subtotalInCents ??
							subtotalInCents,
						serviceFeeInCents:
							tab.split?.serviceFeeInCents ?? payment.serviceFeeInCents ?? 0,
						discountInCents:
							tab.split?.discountInCents ?? payment.discountInCents ?? 0,
						payment:
							payments.length === 1 ? (receiptPayments[0] ?? null) : null,
						payments: receiptPayments,
						totalInCents: payments.reduce((sum, p) => sum + p.amountInCents, 0),
					},
				};
			}
		);
}
