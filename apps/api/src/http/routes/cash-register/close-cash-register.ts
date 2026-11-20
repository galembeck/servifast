/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { CashRegisterException } from "@/http/_errors/exceptions/cash-register";
import { auth } from "@/http/middlewares/auth";
import { computeDrawerBalance, getCashSalesInCents } from "@/lib/cash-register";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "../_errors/conflict-error";
import { ForbiddenError } from "../_errors/forbidden-error";

function cashRegisterNotOpenError() {
	return new ConflictError(
		"Cash register is not open.",
		CashRegisterException.CASH_REGISTER_NOT_OPEN,
		"There is no open cash register to close."
	);
}

function sumByType(
	transactions: { type: string; amountInCents: number }[],
	type: string
) {
	return transactions
		.filter((transaction) => transaction.type === type)
		.reduce((total, transaction) => total + transaction.amountInCents, 0);
}

export async function closeCashRegisterRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/cash-register/close",
			{
				schema: {
					tags: ["Cash register"],
					summary: "/restaurants/:slug/cash-register/close",
					description:
						"Closes the open cash register with a blind count: the operator informs the cash counted in the drawer without seeing the expected amount. The server computes the expected amount (opening float + supplies − withdrawals + cash sales since opening), stores counted/expected/difference, records an immutable CLOSING movement and returns the reconciliation. A closed session can no longer be changed.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: z.object({
						countedAmountInCents: z.number().int().nonnegative(),
					}),
					response: {
						200: z.object({
							session: z.object({
								id: z.uuid(),
								openedAt: z.date(),
								closedAt: z.date(),
								openingAmountInCents: z.number(),
								suppliesInCents: z.number(),
								withdrawalsInCents: z.number(),
								cashSalesInCents: z.number(),
								expectedAmountInCents: z.number(),
								countedAmountInCents: z.number(),
								differenceInCents: z.number(),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { countedAmountInCents } = request.body;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("manage", "Shift")) {
					throw new ForbiddenError(
						"You are not authorized to operate the cash register.",
						AuthException.FORBIDDEN,
						"Only cashiers, managers and owners can close the cash register."
					);
				}

				const session = await prisma.cashRegisterSession.findFirst({
					where: { restaurantId: restaurant.id, closedAt: null },
					select: {
						id: true,
						openedAt: true,
						openingAmountInCents: true,
						transactions: { select: { type: true, amountInCents: true } },
					},
				});

				if (!session) {
					throw cashRegisterNotOpenError();
				}

				const cashSalesInCents = await getCashSalesInCents(
					prisma,
					restaurant.id,
					session.openedAt
				);
				const expectedAmountInCents = computeDrawerBalance(
					session.transactions,
					cashSalesInCents
				);
				const differenceInCents = countedAmountInCents - expectedAmountInCents;
				const closedAt = new Date();

				await prisma.$transaction(
					// biome-ignore lint/suspicious/noExplicitAny: tx type requires generated Prisma client (run db:generate)
					async (tx: any) => {
						// Conditional update: rolls back if another operator closed the
						// register concurrently.
						const result = await tx.cashRegisterSession.updateMany({
							where: { id: session.id, closedAt: null },
							data: {
								closedAt,
								closedById: userId,
								countedAmountInCents,
								expectedAmountInCents,
								differenceInCents,
							},
						});

						if (result.count === 0) {
							throw cashRegisterNotOpenError();
						}

						await tx.cashRegisterTransaction.create({
							data: {
								type: "CLOSING",
								amountInCents: countedAmountInCents,
								sessionId: session.id,
								operatorId: userId,
								restaurantId: restaurant.id,
							},
						});
					}
				);

				return {
					session: {
						id: session.id,
						openedAt: session.openedAt,
						closedAt,
						openingAmountInCents: session.openingAmountInCents,
						suppliesInCents: sumByType(session.transactions, "SUPPLY"),
						withdrawalsInCents: sumByType(session.transactions, "WITHDRAWAL"),
						cashSalesInCents,
						expectedAmountInCents,
						countedAmountInCents,
						differenceInCents,
					},
				};
			}
		);
}
