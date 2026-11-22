/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "../_errors/forbidden-error";

export async function getCashRegisterRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/cash-register",
			{
				schema: {
					tags: ["Cash register"],
					summary: "/restaurants/:slug/cash-register",
					description:
						"Returns the restaurant's currently open cash register, or `null` when it is closed. To keep the closing count blind, the expected drawer balance is never exposed while the register is open.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							session: z
								.object({
									id: z.uuid(),
									openingAmountInCents: z.number(),
									openedAt: z.date(),
									openedBy: z.object({
										id: z.uuid(),
										name: z.string().nullable(),
									}),
								})
								.nullable(),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("get", "Shift")) {
					throw new ForbiddenError(
						"You are not authorized to view the cash register.",
						AuthException.FORBIDDEN,
						"Only cashiers, managers and owners can view the cash register."
					);
				}

				const session = await prisma.cashRegisterSession.findFirst({
					where: { restaurantId: restaurant.id, closedAt: null },
					select: {
						id: true,
						openingAmountInCents: true,
						openedAt: true,
						openedBy: { select: { id: true, name: true } },
					},
				});

				return { session: session ?? null };
			}
		);
}
