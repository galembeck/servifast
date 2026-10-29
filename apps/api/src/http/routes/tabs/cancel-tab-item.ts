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

export async function cancelTabItemRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/restaurants/:slug/tabs/:tabId/items/:itemId/cancel",
			{
				schema: {
					tags: ["Tabs"],
					summary: "/restaurants/:slug/tabs/:tabId/items/:itemId/cancel",
					description:
						"Cancel a tab item that is still in RECEIVED status. Items already sent to the kitchen require `force: true`, which only OWNER and MANAGER may use.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						tabId: z.uuid(),
						itemId: z.uuid(),
					}),
					body: z
						.object({
							force: z.boolean().default(false),
						})
						.nullish(),
					response: {
						200: z.object({
							item: z.object({
								id: z.uuid(),
								quantity: z.number(),
								notes: z.string().nullable(),
								status: z.literal("CANCELLED"),
								unitPriceInCents: z.number(),
								createdAt: z.date(),
								updatedAt: z.date(),
								menuItemId: z.uuid(),
								tabId: z.uuid(),
							}),
							forced: z.boolean(),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug, tabId, itemId } = request.params;
				const force = request.body?.force ?? false;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("update", "Order")) {
					throw new ForbiddenError(
						"You are not authorized to cancel items in this tab.",
						AuthException.FORBIDDEN,
						"User must have enough permission(s) in order to cancel tab items."
					);
				}

				const orderItem = await prisma.orderItem.findUnique({
					where: { id: itemId, tabId, restaurantId: restaurant.id },
					include: { tab: { select: { closedAt: true } } },
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
						"Items can only be cancelled in open tabs."
					);
				}

				if (orderItem.status !== "RECEIVED") {
					throw new ConflictError(
						"Item cannot be cancelled.",
						TabException.ORDER_ITEM_NOT_CANCELLABLE,
						"Only items with RECEIVED status can be cancelled."
					);
				}

				const isForcedCancellation = orderItem.sentToKitchenAt !== null;

				if (isForcedCancellation && !force) {
					throw new ConflictError(
						"Item already sent to kitchen.",
						TabException.ORDER_ITEM_ALREADY_SENT_TO_KITCHEN,
						"Items already sent to the kitchen can only be cancelled with a forced cancellation."
					);
				}

				if (isForcedCancellation && cannot("force_cancel", "Order")) {
					throw new ForbiddenError(
						"You are not authorized to force-cancel items.",
						AuthException.FORBIDDEN,
						"Only owners and managers can cancel items already sent to the kitchen."
					);
				}

				const item = await prisma.$transaction(
					// biome-ignore lint/suspicious/noExplicitAny: tx type requires generated Prisma client (run db:generate)
					async (tx: any) => {
						// A non-forced cancellation must not race with send-to-kitchen.
						const result = await tx.orderItem.updateMany({
							where: isForcedCancellation
								? { id: itemId, status: "RECEIVED" }
								: { id: itemId, status: "RECEIVED", sentToKitchenAt: null },
							data: { status: "CANCELLED" },
						});

						if (result.count === 0) {
							throw new ConflictError(
								"Item cannot be cancelled.",
								TabException.ORDER_ITEM_NOT_CANCELLABLE,
								"Item status changed before cancellation could complete."
							);
						}

						return tx.orderItem.findUnique({ where: { id: itemId } });
					}
				);

				return reply.status(200).send({ item, forced: isForcedCancellation });
			}
		);
}
