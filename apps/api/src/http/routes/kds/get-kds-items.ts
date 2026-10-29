/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { KdsException } from "@/http/_errors/exceptions/kds";
import { RestaurantException } from "@/http/_errors/exceptions/restaurant";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "../_errors/forbidden-error";
import { NotFoundError } from "../_errors/not-found-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";
import { UnprocessableEntityError } from "../_errors/unprocessable-entity-error";

/**
 * Statuses the kitchen still has to work on. Today the enum only has
 * RECEIVED/CANCELLED; add future prep statuses (e.g. PREPARING) here.
 */
const KDS_ACTIVE_STATUSES = ["RECEIVED"] as const;

const sinceSchema = z.iso.datetime({ offset: true });

export async function getKdsItemsRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/kds/items",
			{
				schema: {
					tags: ["KDS"],
					summary: "/restaurants/:slug/kds/items",
					description:
						"Read-only kitchen queue: items sent to the kitchen and not finished yet, oldest first. Pass `since` (ISO 8601) to get only items updated after it; use the returned `serverTime` as the next `since`.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: z.object({
						since: z.string().optional(),
					}),
					response: {
						200: z.object({
							items: z.array(
								z.object({
									id: z.uuid(),
									productId: z.uuid(),
									productName: z.string(),
									quantity: z.number(),
									notes: z.string().nullable(),
									table: z.object({
										number: z.number(),
										positionReference: z.string().nullable(),
									}),
									tabId: z.uuid(),
									sentToKitchenAt: z.date(),
									status: z.enum(KDS_ACTIVE_STATUSES),
								})
							),
							serverTime: z.date(),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { since: rawSince } = request.query;

				const userId = await request.getCurrentUserId();

				const membershipResult = await request
					.getUserMembership(slug)
					.catch(async (error: unknown) => {
						if (error instanceof UnauthorizedError) {
							const restaurantExists = await prisma.restaurant.findUnique({
								where: { slug },
								select: { id: true },
							});

							if (!restaurantExists) {
								throw new NotFoundError(
									"Restaurant not found.",
									RestaurantException.RESTAURANT_NOT_FOUND,
									"No restaurant exists with the specified slug."
								);
							}
						}
						throw error;
					});

				const { restaurant, membership } = membershipResult;
				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("update", "Order")) {
					throw new ForbiddenError(
						"You are not authorized to view the kitchen queue.",
						AuthException.FORBIDDEN,
						"User must have enough permission(s) in order to view the kitchen queue."
					);
				}

				let since: Date | undefined;

				if (rawSince !== undefined) {
					if (!sinceSchema.safeParse(rawSince).success) {
						throw new UnprocessableEntityError(
							"Invalid since parameter.",
							KdsException.INVALID_SINCE,
							"`since` must be an ISO 8601 date-time, e.g. 2026-10-29T12:00:00.000Z."
						);
					}
					since = new Date(rawSince);
				}

				// Captured before reading so nothing updated during the query is
				// missed when the client sends it back as the next `since`.
				const serverTime = new Date();

				const rows = await prisma.orderItem.findMany({
					where: {
						restaurantId: restaurant.id,
						status: { in: [...KDS_ACTIVE_STATUSES] },
						sentToKitchenAt: { not: null },
						...(since && { updatedAt: { gt: since } }),
					},
					orderBy: [{ sentToKitchenAt: "asc" }, { createdAt: "asc" }],
					select: {
						id: true,
						menuItemId: true,
						quantity: true,
						notes: true,
						tabId: true,
						sentToKitchenAt: true,
						status: true,
						menuItem: { select: { name: true } },
						tab: {
							select: {
								table: { select: { number: true, positionReference: true } },
							},
						},
					},
				});

				const items = rows.map((row) => ({
					id: row.id,
					productId: row.menuItemId,
					productName: row.menuItem.name,
					quantity: row.quantity,
					notes: row.notes,
					table: row.tab.table,
					tabId: row.tabId,
					// Guaranteed by the `sentToKitchenAt: { not: null }` filter.
					sentToKitchenAt: row.sentToKitchenAt as Date,
					status: row.status as (typeof KDS_ACTIVE_STATUSES)[number],
				}));

				return { items, serverTime };
			}
		);
}
