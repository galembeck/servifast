/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { auth } from "@/http/middlewares/auth";

export async function getRestaurantRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug",
			{
				schema: {
					tags: ["Restaurant"],
					summary: "/restaurants/:slug",
					description: "Get details from an restaurant by its slug.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							restaurant: z.object({
								id: z.uuid(),
								name: z.string(),
								slug: z.string(),
								domain: z.string().nullable(),
								shouldAttachUsersByDomain: z.boolean(),
								avatarUrl: z.url().nullable(),
								createdAt: z.date(),
								updatedAt: z.date(),
								ownerId: z.uuid(),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;

				const { restaurant } = await request.getUserMembership(slug);

				return {
					restaurant,
				};
			}
		);
}
