/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { CashRegisterException } from "@/http/_errors/exceptions/cash-register";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "../_errors/forbidden-error";
import { NotFoundError } from "../_errors/not-found-error";

const transactionTypeSchema = z.enum([
	"OPENING",
	"SUPPLY",
	"WITHDRAWAL",
	"CLOSING",
]);

const sessionSelect = {
	id: true,
	openedAt: true,
	closedAt: true,
	openingAmountInCents: true,
	countedAmountInCents: true,
	expectedAmountInCents: true,
	differenceInCents: true,
	transactions: {
		orderBy: { createdAt: "asc" },
		select: {
			id: true,
			type: true,
			amountInCents: true,
			description: true,
			createdAt: true,
			operator: { select: { id: true, name: true } },
		},
	},
} as const;

export async function getCashRegisterTransactionsRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/cash-register/transactions",
			{
				schema: {
					tags: ["Cash register"],
					summary: "/restaurants/:slug/cash-register/transactions",
					description:
						"Lists the movements (opening, supplies, withdrawals, closing) of a cash register session, oldest first, with the operator responsible for each one. Defaults to the currently open session (`session: null` when the register is closed); pass `sessionId` to audit a past session. Expected/counted/difference are only filled once the session is closed.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: z.object({
						sessionId: z.uuid().optional(),
					}),
					response: {
						200: z.object({
							session: z
								.object({
									id: z.uuid(),
									openedAt: z.date(),
									closedAt: z.date().nullable(),
									openingAmountInCents: z.number(),
									countedAmountInCents: z.number().nullable(),
									expectedAmountInCents: z.number().nullable(),
									differenceInCents: z.number().nullable(),
								})
								.nullable(),
							transactions: z.array(
								z.object({
									id: z.uuid(),
									type: transactionTypeSchema,
									amountInCents: z.number(),
									description: z.string().nullable(),
									createdAt: z.date(),
									operator: z.object({
										id: z.uuid(),
										name: z.string().nullable(),
									}),
								})
							),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { sessionId } = request.query;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("get", "Shift")) {
					throw new ForbiddenError(
						"You are not authorized to view the cash register.",
						AuthException.FORBIDDEN,
						"Only cashiers, managers and owners can view cash register movements."
					);
				}

				const session = await prisma.cashRegisterSession.findFirst({
					where: sessionId
						? { id: sessionId, restaurantId: restaurant.id }
						: { restaurantId: restaurant.id, closedAt: null },
					select: sessionSelect,
				});

				if (!session && sessionId) {
					throw new NotFoundError(
						"Cash register session not found.",
						CashRegisterException.CASH_REGISTER_SESSION_NOT_FOUND,
						"The cash register session with the specified ID was not found in this restaurant."
					);
				}

				if (!session) {
					return { session: null, transactions: [] };
				}

				const { transactions, ...sessionData } = session;

				return { session: sessionData, transactions };
			}
		);
}
