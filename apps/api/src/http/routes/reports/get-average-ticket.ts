/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { SALES_PERIODS } from "@/lib/sales-period";
import { fetchAverageTicket } from "@/lib/sales-report";
import { ForbiddenError } from "../_errors/forbidden-error";

const ticketSchema = z.object({
	averageTicketInCents: z.number(),
	revenueInCents: z.number(),
	completedServices: z.number(),
});

const rangeSchema = z.object({ start: z.date(), end: z.date() });

export async function getAverageTicketRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/reports/average-ticket",
			{
				schema: {
					tags: ["Reports"],
					summary: "/restaurants/:slug/reports/average-ticket",
					description:
						"Average ticket of a calendar period (America/Sao_Paulo): consolidated revenue / completed services, where a completed service is a closed tab with a payment. Returns the revenue and service count behind it, and the same figures for the previous period cut at the same elapsed time. A period without completed services has an average ticket of 0. Same numbers as the sales dashboard KPI.",
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
							range: rangeSchema,
							comparisonRange: rangeSchema,
							current: ticketSchema,
							previous: ticketSchema,
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
						"Only owners and billing staff can view the average ticket."
					);
				}

				return fetchAverageTicket(prisma, restaurant.id, period);
			}
		);
}
