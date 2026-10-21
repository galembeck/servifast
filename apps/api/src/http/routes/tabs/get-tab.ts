/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { TabException } from "@/http/_errors/exceptions/tab";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "../_errors/not-found-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function getTabRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/tabs/:tabId",
			{
				schema: {
					tags: ["Tabs"],
					summary: "/restaurants/:slug/tabs/:tabId",
					description: "Get a tab with its items",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						tabId: z.uuid(),
					}),
					response: {
						200: z.object({
							tab: z.object({
								id: z.uuid(),
								customerName: z.string().nullable(),
								peopleCount: z.number().nullable(),
								openedAt: z.date(),
								closedAt: z.date().nullable(),
								tableId: z.uuid(),
								items: z.array(
									z.object({
										id: z.uuid(),
										quantity: z.number(),
										notes: z.string().nullable(),
										status: z.literal("RECEIVED"),
										unitPriceInCents: z.number(),
										createdAt: z.date(),
										menuItem: z.object({
											id: z.uuid(),
											name: z.string(),
											imageUrl: z.string().nullable(),
										}),
									})
								),
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

				if (cannot("get", "Order")) {
					throw new UnauthorizedError(
						"You are not authorized to view this tab.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to view this tab."
					);
				}

				const tab = await prisma.tab.findUnique({
					where: { id: tabId, restaurantId: restaurant.id },
					include: {
						items: {
							orderBy: { createdAt: "asc" },
							include: {
								menuItem: {
									select: { id: true, name: true, imageUrl: true },
								},
							},
						},
					},
				});

				if (!tab) {
					throw new NotFoundError(
						"Tab not found.",
						TabException.TAB_NOT_FOUND,
						"The tab with the specified ID was not found in this restaurant."
					);
				}

				return { tab };
			}
		);
}
