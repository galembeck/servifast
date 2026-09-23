/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { MenuException } from "@/http/_errors/exceptions/menu";
import { auth } from "@/http/middlewares/auth";
import { deleteMenuItemImage } from "@/lib/menu-item-image-storage";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function deleteMenuItemRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.delete(
			"/restaurants/:slug/menu-items/:itemId",
			{
				schema: {
					tags: ["Menu"],
					summary: "/restaurants/:slug/menu-items/:itemId",
					description: "Delete a menu item of a restaurant",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						itemId: z.uuid(),
					}),
				},
			},
			async (request, reply) => {
				const { slug, itemId } = request.params;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("delete", "Menu")) {
					throw new UnauthorizedError(
						"You are not authorized to delete this menu item.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to delete this menu item."
					);
				}

				const item = await prisma.menuItem.findUnique({
					where: { id: itemId },
				});

				if (!item || item.restaurantId !== restaurant.id) {
					throw new BadRequestError(
						"This menu item does not exist.",
						MenuException.ITEM_NOT_FOUND,
						"A valid and existing menu item is required to delete it."
					);
				}

				await prisma.menuItem.delete({ where: { id: itemId } });

				if (item.imageUrl) {
					await deleteMenuItemImage(item.imageUrl);
				}

				return reply.status(204).send();
			}
		);
}
