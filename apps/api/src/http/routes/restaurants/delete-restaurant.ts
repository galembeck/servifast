/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { restaurantSchema } from "@repo/rbac/src/models/restaurant.model";
import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function deleteRestaurantRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.delete(
			"/restaurants/:slug",
			{
				schema: {
					tags: ["Restaurant"],
					summary: "/restaurants/:slug",
					description:
						"Delete an restaurant (with required permissions) by its slug.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
				},
			},
			async (request, reply) => {
				const { slug } = request.params;

				const userId = await request.getCurrentUserId();
				const { membership, restaurant } =
					await request.getUserMembership(slug);

				const authRestaurant = restaurantSchema.parse(restaurant);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("delete", authRestaurant)) {
					throw new UnauthorizedError(
						"You are not authorized to delete this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to delete this restaurant."
					);
				}

				await prisma.restaurant.delete({
					where: {
						id: restaurant.id,
					},
				});

				return reply.status(204).send();
			}
		);
}
