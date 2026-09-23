/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function createExpenseRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/expenses",
			{
				schema: {
					tags: ["Billing"],
					summary: "/restaurants/:slug/expenses",
					description: "Register a new expense for a restaurant",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: z.object({
						category: z.string().min(1),
						amount: z.number().positive(),
						date: z.coerce.date(),
					}),
					response: {
						201: z.object({
							expenseId: z.uuid(),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("create", "Billing")) {
					throw new UnauthorizedError(
						"You are not authorized to register expenses for this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to register expenses for this restaurant."
					);
				}

				const { category, amount, date } = request.body;

				const expense = await prisma.expense.create({
					data: {
						restaurantId: restaurant.id,
						category,
						amountInCents: Math.round(amount * 100),
						occurredAt: date,
					},
				});

				return reply.status(201).send({
					expenseId: expense.id,
				});
			}
		);
}
