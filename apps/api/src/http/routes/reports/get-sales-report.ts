/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { SALES_PERIODS } from "@/lib/sales-period";
import { fetchSalesReport, PAYMENT_METHODS } from "@/lib/sales-report";
import { ForbiddenError } from "../_errors/forbidden-error";

const kpisSchema = z.object({
	revenueInCents: z.number(),
	salesCount: z.number(),
	averageTicketInCents: z.number(),
	itemsSold: z.number(),
});

const rangeSchema = z.object({ start: z.date(), end: z.date() });

export async function getSalesReportRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/reports/sales",
			{
				schema: {
					tags: ["Reports"],
					summary: "/restaurants/:slug/reports/sales",
					description:
						"Sales consolidated for a calendar period in the restaurant's time zone (America/Sao_Paulo): `today` (hourly series), `week` (from Monday, daily series) or `month` (from the 1st, daily series). Returns KPIs (revenue, number of sales, average ticket, items sold), the same KPIs for the previous period cut at the same elapsed time, the revenue series (future buckets are null, empty past buckets are 0), revenue by payment method and the top 5 items. A sale is a payment of a closed tab; cancelled items are ignored.",
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
							granularity: z.enum(["hour", "day"]),
							generatedAt: z.date(),
							range: rangeSchema,
							comparisonRange: rangeSchema,
							kpis: kpisSchema,
							previousKpis: kpisSchema,
							series: z.array(
								z.object({
									bucket: z.string(),
									startsAt: z.date(),
									revenueInCents: z.number().nullable(),
									salesCount: z.number().nullable(),
								})
							),
							byPaymentMethod: z.array(
								z.object({
									method: z.enum(PAYMENT_METHODS),
									revenueInCents: z.number(),
									salesCount: z.number(),
								})
							),
							topItems: z.array(
								z.object({
									menuItemId: z.string(),
									name: z.string(),
									quantity: z.number(),
									revenueInCents: z.number(),
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
						"Only owners and billing staff can view the sales dashboard."
					);
				}

				return fetchSalesReport(prisma, restaurant.id, period);
			}
		);
}
