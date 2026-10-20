/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { TableException } from "@/http/_errors/exceptions/table";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "../_errors/conflict-error";
import { NotFoundError } from "../_errors/not-found-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function openTabRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/tables/:tableId/open-tab",
			{
				schema: {
					tags: ["Tables"],
					summary: "/restaurants/:slug/tables/:tableId/open-tab",
					description:
						"Open a tab for a free table, transitioning it to occupied",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						tableId: z.uuid(),
					}),
					body: z.object({
						customerName: z.string().optional(),
						peopleCount: z.number().int().positive().optional(),
					}),
					response: {
						201: z.object({
							tab: z.object({
								id: z.uuid(),
								customerName: z.string().nullable(),
								peopleCount: z.number().nullable(),
								openedAt: z.date(),
							}),
							table: z.object({
								id: z.uuid(),
								status: z.literal("OCCUPIED"),
							}),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug, tableId } = request.params;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("create", "Order")) {
					throw new UnauthorizedError(
						"You are not authorized to open a tab for this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to open a tab."
					);
				}

				const table = await prisma.table.findUnique({
					where: {
						id: tableId,
						restaurantId: restaurant.id,
					},
				});

				if (!table) {
					throw new NotFoundError(
						"Table not found.",
						TableException.TABLE_NOT_FOUND,
						"The table with the specified ID was not found in this restaurant."
					);
				}

				if (table.status !== "FREE") {
					throw new ConflictError(
						"Table is not free.",
						TableException.TABLE_NOT_FREE,
						"The table must be in FREE status to open a tab."
					);
				}

				const { customerName, peopleCount } = request.body;

				const [tab, updatedTable] = await prisma.$transaction(
					// biome-ignore lint/suspicious/noExplicitAny: tx type requires generated Prisma client (run db:generate)
					async (tx: any) => {
						const createdTab = await tx.tab.create({
							data: {
								tableId,
								restaurantId: restaurant.id,
								customerName: customerName ?? null,
								peopleCount: peopleCount ?? null,
							},
						});

						const result = await tx.table.updateMany({
							where: { id: tableId, status: "FREE" },
							data: { status: "OCCUPIED" },
						});

						if (result.count === 0) {
							throw new ConflictError(
								"Table is no longer free.",
								TableException.TABLE_NOT_FREE,
								"Another request already changed the table status."
							);
						}

						return [createdTab, { id: tableId, status: "OCCUPIED" as const }];
					}
				);

				return reply.status(201).send({ tab, table: updatedTable });
			}
		);
}
