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

export async function transferOwnershipRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/restaurants/:slug/ownership",
			{
				schema: {
					tags: ["Restaurant"],
					summary: "/restaurants/:slug",
					description:
						"Update an restaurant ownership by its slug, transfering it to another registered user.",
					security: [{ bearerAuth: [] }],
					body: z.object({
						transferToUserId: z.uuid(),
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

				const { transferToUserId } = request.body;

				const authRestaurant = restaurantSchema.parse(restaurant);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("transfer_ownership", authRestaurant)) {
					throw new UnauthorizedError(
						"You are not authorized to transfer the ownership of this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to transfer the ownership of this restaurant."
					);
				}

				const transferMembership = await prisma.member.findUnique({
					where: {
						restaurantId_userId: {
							restaurantId: restaurant.id,
							userId: transferToUserId,
						},
					},
				});

				if (!transferMembership) {
					throw new BadRequestError(
						"Target user is not a member of the restaurant.",
						RestaurantException.USER_NOT_MEMBER,
						"The user needs to be a member of the restaurant in order to transfer its ownership."
					);
				}

				await prisma.$transaction([
					prisma.member.update({
						where: {
							restaurantId_userId: {
								restaurantId: restaurant.id,
								userId: transferToUserId,
							},
						},
						data: {
							role: "OWNER",
						},
					}),

					prisma.restaurant.update({
						where: {
							id: restaurant.id,
						},
						data: {
							ownerId: transferToUserId,
						},
					}),
				]);

				return reply.status(204).send();
			}
		);
}
