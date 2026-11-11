/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { KdsException } from "@/http/_errors/exceptions/kds";
import { TabException } from "@/http/_errors/exceptions/tab";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "../_errors/conflict-error";
import { ForbiddenError } from "../_errors/forbidden-error";
import { NotFoundError } from "../_errors/not-found-error";

const KITCHEN_TARGET_STATUSES = ["PREPARING", "READY"] as const;

type KitchenTargetStatus = (typeof KITCHEN_TARGET_STATUSES)[number];

/**
 * Kitchen state machine: RECEIVED → PREPARING → READY. Each target status
 * can only be reached from exactly one previous status — no skipping steps
 * and no going back.
 */
const REQUIRED_PREVIOUS_STATUS: Record<
	KitchenTargetStatus,
	"RECEIVED" | "PREPARING"
> = {
	PREPARING: "RECEIVED",
	READY: "PREPARING",
};

export async function updateKdsItemStatusRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/restaurants/:slug/kds/items/:itemId/status",
			{
				schema: {
					tags: ["KDS"],
					summary: "/restaurants/:slug/kds/items/:itemId/status",
					description:
						"Advance a kitchen item through the preparation flow. Transitions are strictly sequential: RECEIVED → PREPARING → READY. Any other transition (skipping a step, going back, or changing a CANCELLED item) is rejected with 409.",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						itemId: z.uuid(),
					}),
					body: z.object({
						status: z.enum(KITCHEN_TARGET_STATUSES),
					}),
					response: {
						200: z.object({
							item: z.object({
								id: z.uuid(),
								status: z.enum(KITCHEN_TARGET_STATUSES),
								updatedAt: z.date(),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug, itemId } = request.params;
				const { status: targetStatus } = request.body;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("update_kitchen_status", "Order")) {
					throw new ForbiddenError(
						"You are not authorized to update kitchen item status.",
						AuthException.FORBIDDEN,
						"Only the kitchen, managers and owners can update the preparation status of items."
					);
				}

				const orderItem = await prisma.orderItem.findUnique({
					where: { id: itemId, restaurantId: restaurant.id },
					select: {
						status: true,
						sentToKitchenAt: true,
						tab: { select: { closedAt: true } },
					},
				});

				if (!orderItem || orderItem.sentToKitchenAt === null) {
					throw new NotFoundError(
						"Kitchen item not found.",
						KdsException.KITCHEN_ITEM_NOT_FOUND,
						"No item sent to the kitchen exists with the specified ID in this restaurant."
					);
				}

				if (orderItem.tab.closedAt !== null) {
					throw new ConflictError(
						"Tab is not open.",
						TabException.TAB_NOT_OPEN,
						"The status of items from closed tabs cannot be changed."
					);
				}

				const requiredStatus = REQUIRED_PREVIOUS_STATUS[targetStatus];

				if (orderItem.status !== requiredStatus) {
					throw new ConflictError(
						"Invalid status transition.",
						KdsException.INVALID_STATUS_TRANSITION,
						`Cannot change from ${orderItem.status} to ${targetStatus}. The item must be ${requiredStatus} first (RECEIVED → PREPARING → READY).`
					);
				}

				// Conditional update: if another device (or a cancellation) changed
				// the item after it was read, nothing is updated.
				const result = await prisma.orderItem.updateMany({
					where: {
						id: itemId,
						status: requiredStatus,
						tab: { closedAt: null },
					},
					data: { status: targetStatus },
				});

				if (result.count === 0) {
					throw new ConflictError(
						"Invalid status transition.",
						KdsException.INVALID_STATUS_TRANSITION,
						"The item status changed before the update could complete. Refresh and try again."
					);
				}

				const updated = await prisma.orderItem.findUnique({
					where: { id: itemId },
					select: { id: true, updatedAt: true },
				});

				return {
					item: {
						id: itemId,
						status: targetStatus,
						updatedAt: updated?.updatedAt ?? new Date(),
					},
				};
			}
		);
}
