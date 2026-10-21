/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "../_errors/unauthorized-error";

const tableStatusSchema = z.enum(["FREE", "OCCUPIED", "BILL_REQUESTED"]);

export async function getTablesRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/tables",
			{
				schema: {
					tags: ["Tables"],
					summary: "/restaurants/:slug/tables",
					description: "List the tables of a restaurant",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							tables: z.array(
								z.object({
									id: z.uuid(),
									number: z.number(),
									positionReference: z.string().nullable(),
									seatsCount: z.number(),
									observations: z.string().nullable(),
									status: tableStatusSchema,
									occupiedSeats: z.number(),
									currentTabId: z.string().uuid().nullable(),
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

				if (cannot("get", "Table")) {
					throw new UnauthorizedError(
						"You are not authorized to view the tables of this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to view the tables of this restaurant."
					);
				}

				const rows = await prisma.table.findMany({
					where: {
						restaurantId: restaurant.id,
					},
					orderBy: {
						number: "asc",
					},
					include: {
						tabs: {
							where: { closedAt: null },
							select: { id: true },
							take: 1,
						},
					},
				});

				const tables = rows.map(({ tabs, ...table }) => ({
					...table,
					currentTabId: tabs[0]?.id ?? null,
				}));

				return { tables };
			}
		);
}
