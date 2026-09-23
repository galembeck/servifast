/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { TableException } from "@/http/_errors/exceptions/table";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function createTableRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/tables",
			{
				schema: {
					tags: ["Tables"],
					summary: "/restaurants/:slug/tables",
					description: "Create a new table for a restaurant",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: z.object({
						number: z.number().int().positive(),
						positionReference: z.string().nullish(),
						seatsCount: z.number().int().positive(),
						observations: z.string().nullish(),
					}),
					response: {
						201: z.object({
							tableId: z.uuid(),
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

				if (cannot("create", "Table")) {
					throw new UnauthorizedError(
						"You are not authorized to create a table for this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to create a table for this restaurant."
					);
				}

				const { number, positionReference, seatsCount, observations } =
					request.body;

				const tableWithSameNumber = await prisma.table.findUnique({
					where: {
						restaurantId_number: {
							restaurantId: restaurant.id,
							number,
						},
					},
				});

				if (tableWithSameNumber) {
					throw new BadRequestError(
						"A table with this number already exists.",
						TableException.TABLE_NUMBER_ALREADY_EXISTS,
						"Choose a different table number for this restaurant."
					);
				}

				const table = await prisma.table.create({
					data: {
						restaurantId: restaurant.id,
						number,
						positionReference,
						seatsCount,
						observations,
					},
				});

				return reply.status(201).send({
					tableId: table.id,
				});
			}
		);
}
