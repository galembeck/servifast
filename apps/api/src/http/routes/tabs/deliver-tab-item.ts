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

export async function deliverTabItemRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/restaurants/:slug/tabs/:tabId/items/:itemId/deliver",
			{
				schema: {
					tags: ["Tabs"],
					summary: "/restaurants/:slug/tabs/:tabId/items/:itemId/deliver",
					description:
						"Mark a READY item as delivered to the table: sets status DELIVERED and records `deliveredAt`. Only READY items of open tabs can be delivered; anything else is rejected with 409.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						tabId: z.uuid(),
						itemId: z.uuid(),
					}),
					response: {
						200: z.object({
							item: z.object({
								id: z.uuid(),
								status: z.literal("DELIVERED"),
								deliveredAt: z.date(),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug, tabId, itemId } = request.params;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("deliver", "Order")) {
					throw new ForbiddenError(
						"You are not authorized to deliver items.",
						AuthException.FORBIDDEN,
						"Only waiters, managers and owners can mark items as delivered."
					);
				}

				const orderItem = await prisma.orderItem.findUnique({
					where: { id: itemId, tabId, restaurantId: restaurant.id },
					select: { status: true, tab: { select: { closedAt: true } } },
				});

				if (!orderItem) {
					throw new NotFoundError(
						"Order item not found.",
						TabException.ORDER_ITEM_NOT_FOUND,
						"The item with the specified ID was not found in this tab."
					);
				}

				if (orderItem.tab.closedAt !== null) {
					throw new ConflictError(
						"Tab is not open.",
						TabException.TAB_NOT_OPEN,
						"Items can only be delivered in open tabs."
					);
				}

				if (orderItem.status !== "READY") {
					throw new ConflictError(
						"Item is not ready.",
						TabException.ORDER_ITEM_NOT_READY,
						`Only READY items can be delivered. This item is ${orderItem.status}.`
					);
				}

				const deliveredAt = new Date();

				// Conditional update: if the item changed after it was read (another
				// waiter delivered it, or it was cancelled), nothing is updated.
				const result = await prisma.orderItem.updateMany({
					where: { id: itemId, status: "READY", tab: { closedAt: null } },
					data: { status: "DELIVERED", deliveredAt },
				});

				if (result.count === 0) {
					throw new ConflictError(
						"Item is not ready.",
						TabException.ORDER_ITEM_NOT_READY,
						"The item status changed before the delivery could be recorded."
					);
				}

				return {
					item: { id: itemId, status: "DELIVERED" as const, deliveredAt },
				};
			}
		);
}
