/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { TableException } from "@/http/_errors/exceptions/table";
import { auth } from "@/http/middlewares/auth";
import { groupBillItems } from "@/lib/bill";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "../_errors/forbidden-error";
import { NotFoundError } from "../_errors/not-found-error";

export async function getTableBillRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/tables/:tableId/bill",
			{
				schema: {
					tags: ["Tables"],
					summary: "/restaurants/:slug/tables/:tableId/bill",
					description:
						"The bill of the table's open tab, computed on every request. Only confirmed items count: items sent to the kitchen and not cancelled. Equal items at the same unit price are grouped into one line.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						tableId: z.uuid(),
					}),
					response: {
						200: z.object({
							bill: z.object({
								table: z.object({
									id: z.uuid(),
									number: z.number(),
									status: z.enum(["FREE", "OCCUPIED", "BILL_REQUESTED"]),
								}),
								tab: z.object({
									id: z.uuid(),
									customerName: z.string().nullable(),
									peopleCount: z.number().nullable(),
									openedAt: z.date(),
								}),
								items: z.array(
									z.object({
										menuItemId: z.uuid(),
										name: z.string(),
										quantity: z.number(),
										unitPriceInCents: z.number(),
										totalInCents: z.number(),
									})
								),
								subtotalInCents: z.number(),
								cancelledItemsCount: z.number(),
								unconfirmedItemsCount: z.number(),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug, tableId } = request.params;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("get", "Table") || cannot("get", "Order")) {
					throw new ForbiddenError(
						"You are not authorized to view bills.",
						AuthException.FORBIDDEN,
						"Only cashiers, waiters, managers and owners can view a table's bill."
					);
				}

				const table = await prisma.table.findUnique({
					where: { id: tableId, restaurantId: restaurant.id },
					select: {
						id: true,
						number: true,
						status: true,
						tabs: {
							where: { closedAt: null },
							take: 1,
							select: {
								id: true,
								customerName: true,
								peopleCount: true,
								openedAt: true,
								items: {
									orderBy: { createdAt: "asc" },
									select: {
										quantity: true,
										unitPriceInCents: true,
										status: true,
										sentToKitchenAt: true,
										menuItem: { select: { id: true, name: true } },
									},
								},
							},
						},
					},
				});

				if (!table) {
					throw new NotFoundError(
						"Table not found.",
						TableException.TABLE_NOT_FOUND,
						"The table with the specified ID was not found in this restaurant."
					);
				}

				const { tabs, ...tableData } = table;
				const openTab = tabs[0];

				if (!openTab) {
					throw new NotFoundError(
						"Table has no open tab.",
						TableException.TABLE_HAS_NO_OPEN_TAB,
						"There is no bill to show: this table has no open tab."
					);
				}

				const { items, ...tab } = openTab;
				const billableItems: typeof items = [];
				let cancelledItemsCount = 0;
				let unconfirmedItemsCount = 0;

				for (const item of items) {
					if (item.status === "CANCELLED") {
						cancelledItemsCount += 1;
					} else if (item.sentToKitchenAt === null) {
						// Items still in the waiter's draft were never confirmed (sent to
						// the kitchen), so they are not part of the bill yet.
						unconfirmedItemsCount += 1;
					} else {
						billableItems.push(item);
					}
				}

				const { lines: billItems, subtotalInCents } =
					groupBillItems(billableItems);

				return {
					bill: {
						table: tableData,
						tab,
						items: billItems,
						subtotalInCents,
						cancelledItemsCount,
						unconfirmedItemsCount,
					},
				};
			}
		);
}
