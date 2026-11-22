/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { CashRegisterException } from "@/http/_errors/exceptions/cash-register";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "../_errors/conflict-error";
import { ForbiddenError } from "../_errors/forbidden-error";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

function cashRegisterAlreadyOpenError() {
	return new ConflictError(
		"Cash register already open.",
		CashRegisterException.CASH_REGISTER_ALREADY_OPEN,
		"Close the current cash register before opening a new one."
	);
}

export async function openCashRegisterRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/cash-register/open",
			{
				schema: {
					tags: ["Cash register"],
					summary: "/restaurants/:slug/cash-register/open",
					description:
						"Opens the restaurant's cash register with the opening float (fundo de troco). Records an immutable OPENING movement attributed to the authenticated operator. Only one cash register may be open per restaurant (409 CASH_REGISTER_ALREADY_OPEN).",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: z.object({
						openingAmountInCents: z.number().int().nonnegative(),
					}),
					response: {
						201: z.object({
							session: z.object({
								id: z.uuid(),
								openingAmountInCents: z.number(),
								openedAt: z.date(),
							}),
							transaction: z.object({
								id: z.uuid(),
								type: z.literal("OPENING"),
								amountInCents: z.number(),
								operatorId: z.uuid(),
								createdAt: z.date(),
							}),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;
				const { openingAmountInCents } = request.body;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("manage", "Shift")) {
					throw new ForbiddenError(
						"You are not authorized to operate the cash register.",
						AuthException.FORBIDDEN,
						"Only cashiers, managers and owners can open the cash register."
					);
				}

				const openSession = await prisma.cashRegisterSession.findFirst({
					where: { restaurantId: restaurant.id, closedAt: null },
					select: { id: true },
				});

				if (openSession) {
					throw cashRegisterAlreadyOpenError();
				}

				try {
					const result = await prisma.$transaction(
						// biome-ignore lint/suspicious/noExplicitAny: tx type requires generated Prisma client (run db:generate)
						async (tx: any) => {
							const session = await tx.cashRegisterSession.create({
								data: {
									openingAmountInCents,
									openedById: userId,
									restaurantId: restaurant.id,
								},
								select: {
									id: true,
									openingAmountInCents: true,
									openedAt: true,
								},
							});

							const transaction = await tx.cashRegisterTransaction.create({
								data: {
									type: "OPENING",
									amountInCents: openingAmountInCents,
									sessionId: session.id,
									operatorId: userId,
									restaurantId: restaurant.id,
								},
								select: {
									id: true,
									type: true,
									amountInCents: true,
									operatorId: true,
									createdAt: true,
								},
							});

							return { session, transaction };
						}
					);

					return reply.status(201).send(result);
				} catch (error) {
					// Another operator opened the register between the check above and
					// the insert: the partial unique index rejects the second session.
					if (
						typeof error === "object" &&
						error !== null &&
						"code" in error &&
						error.code === UNIQUE_CONSTRAINT_VIOLATION
					) {
						throw cashRegisterAlreadyOpenError();
					}

					throw error;
				}
			}
		);
}
