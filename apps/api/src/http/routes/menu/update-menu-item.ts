/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { MenuException } from "@/http/_errors/exceptions/menu";
import { auth } from "@/http/middlewares/auth";
import {
	deleteMenuItemImage,
	saveMenuItemImage,
} from "@/lib/menu-item-image-storage";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";

const menuItemFieldsSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullish(),
	price: z.coerce.number().positive(),
	categoryId: z.uuid(),
	isAvailable: z
		.string()
		.nullish()
		.transform((value) => value === "true"),
});

export async function updateMenuItemRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/restaurants/:slug/menu-items/:itemId",
			{
				schema: {
					tags: ["Menu"],
					summary: "/restaurants/:slug/menu-items/:itemId",
					description: "Update a menu item of a restaurant",
					security: [{ bearerAuth: [] }],
					consumes: ["multipart/form-data"],
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

				if (cannot("update", "Menu")) {
					throw new UnauthorizedError(
						"You are not authorized to update this menu item.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to update this menu item."
					);
				}

				const existingItem = await prisma.menuItem.findUnique({
					where: { id: itemId },
				});

				if (!existingItem || existingItem.restaurantId !== restaurant.id) {
					throw new BadRequestError(
						"This menu item does not exist.",
						MenuException.ITEM_NOT_FOUND,
						"A valid and existing menu item is required to update it."
					);
				}

				const fields: Record<string, string> = {};
				let imageUrl: string | undefined;

				for await (const part of request.parts()) {
					if (part.type === "file") {
						imageUrl = await saveMenuItemImage(part);
					} else {
						fields[part.fieldname] = part.value as string;
					}
				}

				const { name, description, price, categoryId, isAvailable } =
					menuItemFieldsSchema.parse(fields);

				const category = await prisma.menuCategory.findUnique({
					where: { id: categoryId },
				});

				if (!category || category.restaurantId !== restaurant.id) {
					throw new BadRequestError(
						"This menu category does not exist.",
						MenuException.CATEGORY_NOT_FOUND,
						"Choose an existing menu category for this restaurant."
					);
				}

				await prisma.menuItem.update({
					where: { id: itemId },
					data: {
						categoryId,
						name,
						description,
						priceInCents: Math.round(price * 100),
						isAvailable,
						...(imageUrl ? { imageUrl } : {}),
					},
				});

				if (imageUrl && existingItem.imageUrl) {
					await deleteMenuItemImage(existingItem.imageUrl);
				}

				return reply.status(204).send();
			}
		);
}
