import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { FinancialEntryException } from "@/http/_errors/exceptions/financial-entry";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "../_errors/conflict-error";
import { ForbiddenError } from "../_errors/forbidden-error";
import { NotFoundError } from "../_errors/not-found-error";
import {
	financialEntrySchema,
	serializeFinancialEntry,
} from "./financial-entry-schema";

// biome-ignore lint/suspicious/useAwait: Fastify plugin
export async function payFinancialEntryRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/restaurants/:slug/financial-entries/:id/pay",
			{
				schema: {
					tags: ["Billing"],
					summary: "Dar baixa em lançamento pendente",
					security: [{ bearerAuth: [] }],
					params: z.object({ slug: z.string(), id: z.uuid() }),
					body: z.object({ effectiveDate: z.iso.date() }),
					response: { 200: z.object({ entry: financialEntrySchema }) },
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
						AuthException.UNAUTHORIZED,
						"Somente o dono do restaurante pode dar baixa."
					);
				}
				const entry = await prisma.expense.findFirst({
					where: { id: request.params.id, restaurantId: restaurant.id },
				});
				if (!entry) {
					throw new NotFoundError(
						"Lançamento não encontrado",
						FinancialEntryException.NOT_FOUND
					);
				}
				// The conditional UPDATE rechecks PENDING while holding the row lock.
				// Concurrent/repeated requests cannot overwrite the first settlement.
				const [updated] = await prisma.expense.updateManyAndReturn({
					where: {
						id: entry.id,
						restaurantId: restaurant.id,
						type: entry.type,
						status: "PENDING",
					},
					data: {
						status: entry.type === "EXPENSE" ? "PAID" : "RECEIVED",
						settledOn: new Date(`${request.body.effectiveDate}T00:00:00.000Z`),
						settledAt: new Date(),
					},
				});
				if (!updated) {
					throw new ConflictError(
						"Baixa não realizada",
						FinancialEntryException.NOT_PENDING,
						"O lançamento não está pendente. Atualize a listagem para conferir a situação."
					);
				}
				return { entry: serializeFinancialEntry(updated) };
			}
		);
}
