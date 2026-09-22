/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { RestaurantException } from "@/http/_errors/exceptions/restaurant";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { createSlug } from "@/utils/create-slug";
import { BadRequestError } from "../_errors/bad-request-error";

export async function createRestaurantRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants",
			{
				schema: {
					tags: ["Restaurant"],
					summary: "/restaurants",
					description: "Create a new restaurant",
					security: [{ bearerAuth: [] }],
					body: z.object({
						name: z.string(),
						domain: z.string().nullish(),
						shouldAttachUsersByDomain: z.boolean().optional(),
					}),
					response: {
						201: z.object({
							restaurantId: z.uuid(),
						}),
					},
				},
			},
			async (request, reply) => {
				const userId = await request.getCurrentUserId();

				const { name, domain, shouldAttachUsersByDomain } = request.body;

				if (domain) {
					const restaurantByDomain = await prisma.restaurant.findUnique({
						where: { domain },
					});

					if (restaurantByDomain) {
						throw new BadRequestError(
							"Another restaurant with same domain already exists.",
							RestaurantException.DOMAIN_ALREADY_IN_USE
						);
					}
				}

				const restaurant = await prisma.restaurant.create({
					data: {
						name,
						slug: createSlug(name),
						domain,
						shouldAttachUsersByDomain,
						ownerId: userId,
						members: {
							create: {
								userId,
								role: "OWNER",
							},
						},
					},
				});

				return reply.status(201).send({
					restaurantId: restaurant.id,
				});
			}
		);
}
