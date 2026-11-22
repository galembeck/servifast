/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import {
	fetchStockAlerts,
	STOCK_ALERT_FILTERS,
	STOCK_ALERT_LEVELS,
} from "@/lib/stock-alerts";
import { ForbiddenError } from "../_errors/forbidden-error";

export async function getStockAlertsRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/stock/alerts",
			{
				schema: {
					tags: ["Stock"],
					summary: "/restaurants/:slug/stock/alerts",
					description:
						"Low-stock alerts: compares each menu item's current stock with its minimum (only items that track stock and have a minimum). Stock 0 = CRITICAL; 0 < stock <= minimum = LOW. Critical first, then the items furthest below their minimum. `level` filters the list; `summary` always counts every alert.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: z.object({
						level: z.enum(STOCK_ALERT_FILTERS).default("all"),
					}),
					response: {
						200: z.object({
							generatedAt: z.date(),
							filter: z.enum(STOCK_ALERT_FILTERS),
							summary: z.object({
								total: z.number().int(),
								critical: z.number().int(),
								low: z.number().int(),
							}),
							alerts: z.array(
								z.object({
									menuItemId: z.uuid(),
									name: z.string(),
									categoryName: z.string().nullable(),
									stockQuantity: z.number().int(),
									minStockQuantity: z.number().int(),
									level: z.enum(STOCK_ALERT_LEVELS),
									missingToMinimum: z.number().int(),
								})
							),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { level } = request.query;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("get", "Stock")) {
					throw new ForbiddenError(
						"You are not authorized to view stock alerts.",
						AuthException.FORBIDDEN,
						"Only owners and managers can view stock alerts."
					);
				}

				return fetchStockAlerts(prisma, restaurant.id, level);
			}
		);
}
