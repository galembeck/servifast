/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function getMenuItemsRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/menu-items",
			{
				schema: {
					tags: ["Menu"],
					summary: "/restaurants/:slug/menu-items",
					description: "List the menu items of a restaurant",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: z.object({
						categoryId: z.uuid().optional(),
					}),
					response: {
						200: z.object({
							items: z.array(
								z.object({
									id: z.uuid(),
									name: z.string(),
									description: z.string().nullable(),
									priceInCents: z.number(),
									imageUrl: z.string().nullable(),
									categoryId: z.uuid(),
									isAvailable: z.boolean(),
								})
							),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { categoryId } = request.query;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("get", "Menu")) {
					throw new UnauthorizedError(
						"You are not authorized to view the menu items of this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to view the menu items of this restaurant."
					);
				}

				const items = await prisma.menuItem.findMany({
					where: {
						restaurantId: restaurant.id,
						...(categoryId ? { categoryId } : {}),
					},
					orderBy: {
						createdAt: "asc",
					},
				});

				return {
					items,
				};
			}
		);
}
