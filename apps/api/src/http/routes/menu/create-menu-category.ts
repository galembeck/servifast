/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { MenuException } from "@/http/_errors/exceptions/menu";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function createMenuCategoryRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/menu-categories",
			{
				schema: {
					tags: ["Menu"],
					summary: "/restaurants/:slug/menu-categories",
					description: "Create a new menu category for a restaurant",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: z.object({
						name: z.string().min(1),
					}),
					response: {
						201: z.object({
							categoryId: z.uuid(),
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

				if (cannot("create", "Menu")) {
					throw new UnauthorizedError(
						"You are not authorized to create a menu category for this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to create a menu category for this restaurant."
					);
				}

				const { name } = request.body;

				const categoryWithSameName = await prisma.menuCategory.findUnique({
					where: {
						restaurantId_name: {
							restaurantId: restaurant.id,
							name,
						},
					},
				});

				if (categoryWithSameName) {
					throw new BadRequestError(
						"A menu category with this name already exists.",
						MenuException.CATEGORY_NAME_ALREADY_EXISTS,
						"Choose a different name for this menu category."
					);
				}

				const category = await prisma.menuCategory.create({
					data: {
						restaurantId: restaurant.id,
						name,
					},
				});

				return reply.status(201).send({
					categoryId: category.id,
				});
			}
		);
}
