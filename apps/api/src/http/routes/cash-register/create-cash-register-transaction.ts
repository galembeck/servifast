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
import { UnprocessableEntityError } from "../_errors/unprocessable-entity-error";

const DESCRIPTION_MAX_LENGTH = 200;

const movementTypeSchema = z.enum(["SUPPLY", "WITHDRAWAL"]);

export async function createCashRegisterTransactionRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/cash-register/transactions",
			{
				schema: {
					tags: ["Cash register"],
					summary: "/restaurants/:slug/cash-register/transactions",
					description:
						"Records a supply (SUPPLY, suprimento) or a withdrawal (WITHDRAWAL, sangria) on the open cash register. Movements are immutable and attributed to the authenticated operator. A withdrawal cannot exceed the cash currently in the drawer (422 INSUFFICIENT_CASH_BALANCE).",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: z.object({
						type: movementTypeSchema,
						amountInCents: z.number().int().positive(),
						description: z
							.string()
							.trim()
							.max(DESCRIPTION_MAX_LENGTH)
							.optional(),
					}),
					response: {
						201: z.object({
							transaction: z.object({
								id: z.uuid(),
								type: movementTypeSchema,
								amountInCents: z.number(),
								description: z.string().nullable(),
								operatorId: z.uuid(),
								sessionId: z.uuid(),
								createdAt: z.date(),
							}),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;
				const { type, amountInCents, description } = request.body;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("manage", "Shift")) {
					throw new ForbiddenError(
						"You are not authorized to operate the cash register.",
						AuthException.FORBIDDEN,
						"Only cashiers, managers and owners can record cash register movements."
					);
				}

				const session = await prisma.cashRegisterSession.findFirst({
					where: { restaurantId: restaurant.id, closedAt: null },
					select: {
						id: true,
						openedAt: true,
						transactions: { select: { type: true, amountInCents: true } },
					},
				});

				if (!session) {
					throw new ConflictError(
						"Cash register is not open.",
						CashRegisterException.CASH_REGISTER_NOT_OPEN,
						"Open the cash register before recording supplies or withdrawals."
					);
				}

				if (type === "WITHDRAWAL") {
					const cashSalesInCents = await getCashSalesInCents(
						prisma,
						restaurant.id,
						session.openedAt
					);
					const balanceInCents = computeDrawerBalance(
						session.transactions,
						cashSalesInCents
					);

					if (amountInCents > balanceInCents) {
						throw new UnprocessableEntityError(
							"Insufficient cash balance.",
							CashRegisterException.INSUFFICIENT_CASH_BALANCE,
							"The withdrawal amount is greater than the cash available in the drawer."
						);
					}
				}

				const transaction = await prisma.cashRegisterTransaction.create({
					data: {
						type,
						amountInCents,
						description: description || null,
						sessionId: session.id,
						operatorId: userId,
						restaurantId: restaurant.id,
					},
					select: {
						id: true,
						amountInCents: true,
						description: true,
						operatorId: true,
						sessionId: true,
						createdAt: true,
					},
				});

				return reply
					.status(201)
					.send({ transaction: { ...transaction, type } });
			}
		);
}
