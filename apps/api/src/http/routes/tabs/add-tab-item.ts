/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { MenuException } from "@/http/_errors/exceptions/menu";
import { TabException } from "@/http/_errors/exceptions/tab";
import { auth } from "@/http/middlewares/auth";
import { assertUnsplitTab } from "@/lib/bill-split";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { ConflictError } from "../_errors/conflict-error";
import { NotFoundError } from "../_errors/not-found-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";
import { UnprocessableEntityError } from "../_errors/unprocessable-entity-error";

export async function addTabItemRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/tabs/:tabId/items",
			{
				schema: {
					tags: ["Tabs"],
					summary: "/restaurants/:slug/tabs/:tabId/items",
					description:
						"Add an item to an open tab. Rejects with 422 ITEM_OUT_OF_STOCK when the item tracks stock and has fewer units than requested (stock is only decremented when the tab is closed).",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						tabId: z.uuid(),
					}),
					body: z.object({
						menuItemId: z.uuid(),
						quantity: z.number().int().min(1),
						notes: z.string().max(500).optional(),
					}),
					response: {
						201: z.object({
							item: z.object({
								id: z.uuid(),
								quantity: z.number(),
								notes: z.string().nullable(),
								status: z.literal("RECEIVED"),
								unitPriceInCents: z.number(),
								createdAt: z.date(),
								menuItemId: z.uuid(),
								tabId: z.uuid(),
							}),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug, tabId } = request.params;
				const { menuItemId, quantity, notes } = request.body;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("create", "Order")) {
					throw new UnauthorizedError(
						"You are not authorized to add items to a tab.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to add items to a tab."
					);
				}

				await assertUnsplitTab(prisma, tabId, restaurant.id);
				const tab = await prisma.tab.findUnique({
					where: { id: tabId, restaurantId: restaurant.id },
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
						"Items can only be added to open tabs."
					);
				}

				const menuItem = await prisma.menuItem.findUnique({
					where: { id: menuItemId, restaurantId: restaurant.id },
				});

				if (!menuItem) {
					throw new NotFoundError(
						"Menu item not found.",
						MenuException.ITEM_NOT_FOUND,
						"The menu item with the specified ID was not found in this restaurant."
					);
				}

				if (!menuItem.isAvailable) {
					throw new BadRequestError(
						"Menu item is not available.",
						MenuException.ITEM_UNAVAILABLE,
						"Only available menu items can be added to a tab."
					);
				}

				const isOutOfStock =
					menuItem.stockQuantity !== null && menuItem.stockQuantity < quantity;

				if (isOutOfStock) {
					throw new UnprocessableEntityError(
						"Not enough stock.",
						MenuException.ITEM_OUT_OF_STOCK,
						`Only ${menuItem.stockQuantity} unit(s) of this item in stock.`
					);
				}

				const item = await prisma.$transaction(
					// biome-ignore lint/suspicious/noExplicitAny: tx type requires generated Prisma client (run db:generate)
					async (tx: any) => {
						const currentTab = await tx.tab.findUnique({
							where: { id: tabId, closedAt: null },
						});

						if (!currentTab) {
							throw new ConflictError(
								"Tab is no longer open.",
								TabException.TAB_NOT_OPEN,
								"Another request already closed the tab."
							);
						}

						return tx.orderItem.create({
							data: {
								tabId,
								menuItemId,
								restaurantId: restaurant.id,
								quantity,
								notes: notes ?? null,
								status: "RECEIVED",
								unitPriceInCents: menuItem.priceInCents,
							},
						});
					}
				);

				return reply.status(201).send({ item });
			}
		);
}
