import { MAX_PAYMENT_IN_CENTS } from "@repo/checkout";
import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { registerPartialPayment } from "@/lib/partial-payment";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "../_errors/forbidden-error";
import { adjustment, splitResponse } from "./split-bill";

// biome-ignore lint/suspicious/useAwait: Fastify plugin
export async function partialPaymentRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/tabs/:tabId/partial-payment",
			{
				schema: {
					tags: ["Tabs"],
					summary: "Registrar pagamento parcial livre da comanda",
					description:
						"Valor em centavos positivo e menor que o saldo. requestId identifica a tentativa e deve ser reutilizado em retries. O primeiro pagamento fixa os ajustes e baixa o estoque; use /close para quitar o restante.",
					security: [{ bearerAuth: [] }],
					params: z.object({ slug: z.string(), tabId: z.uuid() }),
					body: z.object({
						requestId: z.uuid(),
						amountInCents: z
							.number()
							.int()
							.positive()
							.max(MAX_PAYMENT_IN_CENTS),
						method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "PIX"]),
						receivedInCents: z
							.number()
							.int()
							.min(0)
							.max(MAX_PAYMENT_IN_CENTS)
							.optional(),
						serviceFee: adjustment.optional(),
						discount: adjustment.optional(),
					}),
					response: splitResponse,
				},
			},
			async (request) => {
				const userId = await request.getCurrentUserId();
				const { restaurant, membership } = await request.getUserMembership(
					request.params.slug
				);
				if (
					getUserPermissions(userId, membership.role).cannot("close", "Order")
				) {
					throw new ForbiddenError("Acesso negado", AuthException.FORBIDDEN);
				}
				return {
					split: await registerPartialPayment(
						prisma,
						request.params.tabId,
						restaurant.id,
						userId,
						request.body
					),
				};
			}
		);
}
