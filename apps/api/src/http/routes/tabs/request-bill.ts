/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { TabException } from "@/http/_errors/exceptions/tab";
import { TableException } from "@/http/_errors/exceptions/table";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "../_errors/conflict-error";
import { ForbiddenError } from "../_errors/forbidden-error";
import { NotFoundError } from "../_errors/not-found-error";

export async function requestBillRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/restaurants/:slug/tabs/:tabId/request-bill",
			{
				schema: {
					tags: ["Tabs"],
					summary: "/restaurants/:slug/tabs/:tabId/request-bill",
					description:
						"The customer asked for the bill: moves the tab's table from OCCUPIED to BILL_REQUESTED so the cashier knows it is ready for checkout. Only open tabs whose table is OCCUPIED are accepted; anything else is rejected with 409.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						tabId: z.uuid(),
					}),
					response: {
						200: z.object({
							table: z.object({
								id: z.uuid(),
								status: z.literal("BILL_REQUESTED"),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug, tabId } = request.params;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("update", "Table")) {
					throw new ForbiddenError(
						"You are not authorized to request the bill.",
						AuthException.FORBIDDEN,
						"Only waiters, managers and owners can request the bill for a table."
					);
				}

				const tab = await prisma.tab.findUnique({
					where: { id: tabId, restaurantId: restaurant.id },
					select: { closedAt: true, tableId: true },
				});

				if (!tab) {
					throw new NotFoundError(
						"Tab not found.",
						TabException.TAB_NOT_FOUND,
						"The tab with the specified ID was not found in this restaurant."
					);
				}

				if (tab.closedAt !== null) {
					throw new ConflictError(
						"Tab is not open.",
						TabException.TAB_NOT_OPEN,
						"The bill can only be requested for open tabs."
					);
				}

				// Conditional update: only an OCCUPIED table moves to BILL_REQUESTED,
				// so a repeated or concurrent request changes nothing.
				const result = await prisma.table.updateMany({
					where: { id: tab.tableId, status: "OCCUPIED" },
					data: { status: "BILL_REQUESTED" },
				});

				if (result.count === 0) {
					throw new ConflictError(
						"Table is not occupied.",
						TableException.TABLE_NOT_OCCUPIED,
						"The bill was already requested for this table, or the table is not occupied."
					);
				}

				return {
					table: { id: tab.tableId, status: "BILL_REQUESTED" as const },
				};
			}
		);
}
