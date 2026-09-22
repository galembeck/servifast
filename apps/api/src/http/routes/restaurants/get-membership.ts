/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { roleSchema } from "@repo/rbac/src/types/role";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { auth } from "@/http/middlewares/auth";

export async function getMembershipRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/membership",
			{
				schema: {
					tags: ["Restaurant"],
					summary: "/restaurants/{slug}/membership",
					description: "Get user membership on an restaurant",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							membership: z.object({
								id: z.uuid(),
								role: roleSchema,
								userId: z.uuid(),
								restaurantId: z.uuid(),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;

				const { membership } = await request.getUserMembership(slug);

				return {
					membership: {
						id: membership.id,
						role: membership.role,
						userId: membership.userId,
						restaurantId: membership.restaurantId,
					},
				};
			}
		);
}
