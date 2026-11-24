import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "../_errors/forbidden-error";
import {
	financialEntrySchema,
	serializeFinancialEntry,
} from "./financial-entry-schema";

// biome-ignore lint/suspicious/useAwait: Fastify plugin
export async function getFinancialEntriesRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/restaurants/:slug/financial-entries",
			{
				schema: {
					tags: ["Billing"],
					summary: "Localizar lançamentos para baixa",
					security: [{ bearerAuth: [] }],
					params: z.object({ slug: z.string() }),
					response: {
						200: z.object({ entries: z.array(financialEntrySchema) }),
					},
				},
			},
			async (request) => {
				const userId = await request.getCurrentUserId();
				const { restaurant, membership } = await request.getUserMembership(
					request.params.slug
				);
				if (membership.role !== "OWNER" || restaurant.ownerId !== userId) {
					throw new ForbiddenError("Acesso negado", AuthException.UNAUTHORIZED);
				}
				const entries = await prisma.expense.findMany({
					where: { restaurantId: restaurant.id },
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				});
				return { entries: entries.map(serializeFinancialEntry) };
			}
		);
}
