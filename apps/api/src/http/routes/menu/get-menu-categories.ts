/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function getMenuCategoriesRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/menu-categories",
			{
				schema: {
					tags: ["Menu"],
					summary: "/restaurants/:slug/menu-categories",
					description: "List the menu categories of a restaurant",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							categories: z.array(
								z.object({
									id: z.uuid(),
									name: z.string(),
								})
							),
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

				if (cannot("get", "Menu")) {
					throw new UnauthorizedError(
						"You are not authorized to view the menu categories of this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to view the menu categories of this restaurant."
					);
				}

				const categories = await prisma.menuCategory.findMany({
					where: {
						restaurantId: restaurant.id,
					},
					orderBy: {
						createdAt: "asc",
					},
				});

				return {
					categories,
				};
			}
		);
}
