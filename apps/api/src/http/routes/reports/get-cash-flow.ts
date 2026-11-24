import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { fetchCashFlow } from "@/lib/cash-flow";
import { prisma } from "@/lib/prisma";
import { SALES_PERIODS } from "@/lib/sales-period";
import { ForbiddenError } from "../_errors/forbidden-error";

const amounts = z.object({
	incomingInCents: z.number().int(),
	outgoingInCents: z.number().int(),
	netInCents: z.number().int(),
});
// biome-ignore lint/suspicious/useAwait: Fastify plugin
export async function getCashFlowRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/reports/cash-flow",
			{
				schema: {
					tags: ["Reports"],
					summary: "Fluxo de caixa consolidado",
					description:
						"Owner-only report in America/Sao_Paulo: today, week (Monday) or month (1st), through now. Payments use createdAt and amountInCents; manual entries use their settledOn calendar day through today, only PAID expenses and RECEIVED income. Daily series includes zero days. Cash supplies/withdrawals, pending and legacy entries are excluded.",
					security: [{ bearerAuth: [] }],
					params: z.object({ slug: z.string() }),
					querystring: z.object({ period: z.enum(SALES_PERIODS) }),
					response: {
						200: z.object({
							period: z.enum(SALES_PERIODS),
							granularity: z.literal("day"),
							generatedAt: z.date(),
							range: z.object({ start: z.date(), end: z.date() }),
							totals: amounts,
							series: z.array(amounts.extend({ bucket: z.string() })),
						}),
					},
				},
			},
			async (request) => {
				const userId = await request.getCurrentUserId();
				const { restaurant, membership } = await request.getUserMembership(
					request.params.slug
				);
				if (membership.role !== "OWNER" || restaurant.ownerId !== userId) {
					throw new ForbiddenError(
						"Acesso negado",
						AuthException.FORBIDDEN,
						"Somente o dono do restaurante pode consultar o fluxo de caixa consolidado."
					);
				}
				return fetchCashFlow(prisma, restaurant.id, request.query.period);
			}
		);
}
