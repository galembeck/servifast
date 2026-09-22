/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { roleSchema } from "@repo/rbac/src/types/role";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";

export async function getRestaurantsRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants",
			{
				schema: {
					tags: ["Restaurant"],
					summary: "/restaurants",
					description: "Get restaurants where user has membership",
					security: [{ bearerAuth: [] }],
					response: {
						200: z.object({
							restaurants: z.array(
								z.object({
									id: z.uuid(),
									name: z.string(),
									slug: z.string(),
									avatarUrl: z.url().nullable(),
									role: roleSchema,
								})
							),
						}),
					},
				},
			},
			async (request) => {
				const userId = await request.getCurrentUserId();

				const restaurants = await prisma.restaurant.findMany({
					select: {
						id: true,
						name: true,
						slug: true,
						avatarUrl: true,
						members: {
							select: {
								role: true,
							},
							where: {
								userId,
							},
						},
					},
					where: {
						members: {
							some: {
								userId,
							},
						},
					},
				});

				const restaurantsWithUserRole = restaurants.flatMap(
					({ members, ...restaurant }) => {
						const membership = members[0];

						return membership ? [{ ...restaurant, role: membership.role }] : [];
					}
				);

				return {
					restaurants: restaurantsWithUserRole,
				};
			}
		);
}
