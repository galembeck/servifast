/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { TabException } from "@/http/_errors/exceptions/tab";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "../_errors/conflict-error";
import { ForbiddenError } from "../_errors/forbidden-error";
import { NotFoundError } from "../_errors/not-found-error";

export async function sendToKitchenRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/tabs/:tabId/send-to-kitchen",
			{
				schema: {
					tags: ["Tabs"],
					summary: "/restaurants/:slug/tabs/:tabId/send-to-kitchen",
					description:
						"Send pending RECEIVED items to the kitchen queue (KDS outbox)",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						tabId: z.uuid(),
					}),
					response: {
						200: z.object({
							event: z.object({
								id: z.uuid(),
								sentAt: z.date(),
								tableNumber: z.number(),
								items: z.array(
									z.object({
										id: z.uuid(),
										productId: z.uuid(),
										name: z.string(),
										quantity: z.number(),
										notes: z.string().nullable(),
									})
								),
							}),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug, tabId } = request.params;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("update", "Order")) {
					throw new ForbiddenError(
						"You are not authorized to send orders to the kitchen.",
						AuthException.FORBIDDEN,
						"User must have enough permission(s) in order to send tab items to the kitchen."
					);
				}

				const tab = await prisma.tab.findUnique({
					where: { id: tabId, restaurantId: restaurant.id },
					include: { table: { select: { number: true } } },
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
						"Items can only be sent to the kitchen from open tabs."
					);
				}

				const { event, sentItems } = await prisma.$transaction(
					// biome-ignore lint/suspicious/noExplicitAny: tx type requires generated Prisma client (run db:generate)
					async (tx: any) => {
						const pendingItems = await tx.orderItem.findMany({
							where: {
								tabId,
								restaurantId: restaurant.id,
								status: "RECEIVED",
								sentToKitchenAt: null,
							},
							include: { menuItem: { select: { id: true, name: true } } },
						});

						if (pendingItems.length === 0) {
							throw new ConflictError(
								"No items to send.",
								TabException.NO_ITEMS_TO_SEND,
								"All items have already been sent to the kitchen or the tab has no RECEIVED items."
							);
						}

						const ids = pendingItems.map((item) => item.id);
						const sentAt = new Date();

						const result = await tx.orderItem.updateMany({
							where: { id: { in: ids }, sentToKitchenAt: null },
							data: { sentToKitchenAt: sentAt },
						});

						if (result.count !== ids.length) {
							throw new ConflictError(
								"Concurrent send detected.",
								TabException.NO_ITEMS_TO_SEND,
								"Another request already sent some of these items. Please try again."
							);
						}

						const itemsSnapshot = pendingItems.map((item) => ({
							id: item.id,
							productId: item.menuItemId,
							name: item.menuItem.name,
							quantity: item.quantity,
							notes: item.notes,
						}));

						const kdsEvent = await tx.kdsEvent.create({
							data: {
								tabId,
								restaurantId: restaurant.id,
								items: itemsSnapshot,
							},
						});

						return { event: kdsEvent, sentItems: pendingItems };
					}
				);

				return reply.status(200).send({
					event: {
						id: event.id,
						sentAt: event.sentAt,
						tableNumber: tab.table.number,
						items: sentItems.map((item) => ({
							id: item.id,
							productId: item.menuItemId,
							name: item.menuItem.name,
							quantity: item.quantity,
							notes: item.notes,
						})),
					},
				});
			}
		);
}
