/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { restaurantSchema } from "@repo/rbac/src/models/restaurant.model";
import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { RestaurantException } from "@/http/_errors/exceptions/restaurant";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function updateRestaurantRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/restaurants/:slug",
			{
				schema: {
					tags: ["Restaurant"],
					summary: "/restaurants/:slug",
					description:
						"Update an restaurant detail(s)/information(s) by its slug.",
					security: [{ bearerAuth: [] }],
					body: z.object({
						name: z.string(),
						shouldAttachUsersByDomain: z.boolean().optional(),
					}),
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

				const { name, shouldAttachUsersByDomain } = request.body;

				const authRestaurant = restaurantSchema.parse(restaurant);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("update", authRestaurant)) {
					throw new UnauthorizedError(
						"You are not authorized to update this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to update this restaurant."
					);
				}

				if (restaurant.domain) {
					const restaurantByDomain = await prisma.restaurant.findFirst({
						where: {
							domain: restaurant.domain,
							id: {
								not: restaurant.id,
							},
						},
					});

					if (restaurantByDomain) {
						throw new BadRequestError(
							"Another restaurant with same domain already exists.",
							RestaurantException.DOMAIN_ALREADY_IN_USE
						);
					}
				}

				await prisma.restaurant.update({
					where: {
						id: restaurant.id,
					},
					data: {
						name,
						shouldAttachUsersByDomain,
					},
				});

				return reply.status(204).send();
			}
		);
}
