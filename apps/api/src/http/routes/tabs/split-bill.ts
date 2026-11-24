import { MAX_PAYMENT_IN_CENTS } from "@repo/checkout";
import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { TabException } from "@/http/_errors/exceptions/tab";
import { auth } from "@/http/middlewares/auth";
import {
	createBillSplit,
	payBillInvoice,
	previewBillSplit,
	readBillSplit,
} from "@/lib/bill-split";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "../_errors/forbidden-error";
import { NotFoundError } from "../_errors/not-found-error";

const adjustment = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("FIXED"),
		amountInCents: z.number().int().min(0).max(MAX_PAYMENT_IN_CENTS),
	}),
	z.object({
		type: z.literal("PERCENT"),
		basisPoints: z.number().int().min(0).max(10_000),
	}),
]);
const common = z.object({
	requestId: z.uuid(),
	previewToken: z.string().length(64).optional(),
	serviceFee: adjustment.optional(),
	discount: adjustment.optional(),
});
const input = z.discriminatedUnion("mode", [
	common.extend({
		mode: z.literal("PEOPLE"),
		people: z.number().int().min(2).max(100),
	}),
	common.extend({
		mode: z.literal("ITEMS"),
		clients: z
			.array(
				z.object({
					name: z.string().trim().min(1).max(80),
					items: z
						.array(
							z.object({
								itemId: z.uuid(),
								quantity: z.number().int().positive().max(MAX_PAYMENT_IN_CENTS),
							})
						)
						.min(1),
				})
			)
			.min(2)
			.max(100),
	}),
]);
const amounts = z.object({
	subtotalInCents: z.number(),
	serviceFeeInCents: z.number(),
	discountInCents: z.number(),
	amountInCents: z.number(),
});
const part = z.object({
	position: z.number(),
	name: z.string(),
	amountInCents: z.number(),
	subtotalInCents: z.number().nullable(),
	serviceFeeInCents: z.number().nullable(),
	discountInCents: z.number().nullable(),
	items: z.unknown(),
});
const payment = z.object({
	id: z.uuid(),
	method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "PIX"]),
	amountInCents: z.number(),
	receivedInCents: z.number().nullable(),
	changeInCents: z.number().nullable(),
	createdAt: z.date(),
});
const split = amounts.extend({
	id: z.uuid(),
	mode: z.string(),
	paidInCents: z.number(),
	remainingInCents: z.number(),
	closedAt: z.date().nullable(),
	invoices: z.array(part.extend({ id: z.uuid(), payment: payment.nullable() })),
});
const splitResponse = { 200: z.object({ split: split.nullable() }) };
const previewResponse = {
	200: z.object({
		preview: z.object({
			fingerprint: z.string(),
			totals: amounts,
			parts: z.array(part),
		}),
	}),
};
const params = z.object({ slug: z.string(), tabId: z.uuid() });
async function scope(request: FastifyRequest, slug: string) {
	const userId = await request.getCurrentUserId();
	const { restaurant, membership } = await request.getUserMembership(slug);
	if (getUserPermissions(userId, membership.role).cannot("close", "Order")) {
		throw new ForbiddenError("Acesso negado", AuthException.FORBIDDEN);
	}
	return { restaurantId: restaurant.id, userId };
}
// biome-ignore lint/suspicious/useAwait: Fastify plugin
export async function splitBillRoutes(app: FastifyInstance) {
	const secured = app.withTypeProvider<ZodTypeProvider>().register(auth);
	const meta = { tags: ["Tabs"], security: [{ bearerAuth: [] }] };
	secured.post(
		"/restaurants/:slug/tabs/:tabId/split/preview",
		{
			schema: {
				...meta,
				summary: "Prévia da divisão",
				params,
				body: input,
				response: previewResponse,
			},
		},
		async (request) => {
			const { restaurantId } = await scope(request, request.params.slug);
			return {
				preview: await previewBillSplit(
					prisma,
					request.params.tabId,
					restaurantId,
					request.body
				),
			};
		}
	);
	secured.post(
		"/restaurants/:slug/tabs/:tabId/split",
		{
			schema: {
				...meta,
				summary: "Confirmar divisão e bloquear itens/ajustes",
				response: splitResponse,
				params,
				body: input,
			},
		},
		async (request) => {
			const { restaurantId } = await scope(request, request.params.slug);
			return {
				split: await createBillSplit(
					prisma,
					request.params.tabId,
					restaurantId,
					request.body
				),
			};
		}
	);
	secured.get(
		"/restaurants/:slug/tabs/:tabId/split",
		{
			schema: {
				...meta,
				summary: "Parcelas pagas, pendentes e saldo restante",
				response: splitResponse,
				params,
			},
		},
		async (request) => {
			const { restaurantId } = await scope(request, request.params.slug);
			if (
				!(await prisma.tab.findUnique({
					where: { id: request.params.tabId, restaurantId },
					select: { id: true },
				}))
			) {
				throw new NotFoundError(
					"Comanda não encontrada",
					TabException.TAB_NOT_FOUND
				);
			}
			return {
				split: await readBillSplit(prisma, request.params.tabId, restaurantId),
			};
		}
	);
	secured.post(
		"/restaurants/:slug/tabs/:tabId/split/:invoiceId/pay",
		{
			schema: {
				...meta,
				summary: "Pagar uma parcela (idempotente por parcela)",
				response: splitResponse,
				params: params.extend({ invoiceId: z.uuid() }),
				body: z.object({
					method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "PIX"]),
					receivedInCents: z
						.number()
						.int()
						.min(0)
						.max(MAX_PAYMENT_IN_CENTS)
						.optional(),
				}),
			},
		},
		async (request) => {
			const { restaurantId, userId } = await scope(
				request,
				request.params.slug
			);
			return {
				split: await payBillInvoice(
					prisma,
					request.params.tabId,
					restaurantId,
					request.params.invoiceId,
					userId,
					request.body
				),
			};
		}
	);
}
