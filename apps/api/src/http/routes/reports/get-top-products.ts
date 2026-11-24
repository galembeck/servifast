/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { SALES_PERIODS } from "@/lib/sales-period";
import { fetchTopProducts } from "@/lib/sales-report";
import { ForbiddenError } from "../_errors/forbidden-error";

export async function getTopProductsRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/reports/top-products",
			{
				schema: {
					tags: ["Reports"],
					summary: "/restaurants/:slug/reports/top-products",
					description:
						"Top 10 products of a calendar period (America/Sao_Paulo) by units sold, consolidated from tabs with receipts in the period (one item count per tab, split receipts summed; cancelled items excluded). Ties are broken by revenue, then name. Each product carries its share of all units sold, its revenue, how many services ordered it and the average ticket of those services.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: z.object({
						period: z.enum(SALES_PERIODS),
					}),
					response: {
						200: z.object({
							period: z.enum(SALES_PERIODS),
							generatedAt: z.date(),
							range: z.object({ start: z.date(), end: z.date() }),
							totalUnits: z.number(),
							products: z.array(
								z.object({
									rank: z.number(),
									menuItemId: z.string(),
									name: z.string(),
									categoryName: z.string().nullable(),
									quantity: z.number(),
									unitsShare: z.number(),
									revenueInCents: z.number(),
									servicesCount: z.number(),
									averageTicketWithItemInCents: z.number(),
								})
							),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { period } = request.query;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("get", "Report")) {
					throw new ForbiddenError(
						"You are not authorized to view sales reports.",
						AuthException.FORBIDDEN,
						"Only owners and billing staff can view the top products."
					);
				}

				return fetchTopProducts(prisma, restaurant.id, period);
			}
		);
}
