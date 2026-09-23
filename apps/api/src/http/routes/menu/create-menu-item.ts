/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { MenuException } from "@/http/_errors/exceptions/menu";
import { auth } from "@/http/middlewares/auth";
import { saveMenuItemImage } from "@/lib/menu-item-image-storage";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";

const menuItemFieldsSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullish(),
	price: z.coerce.number().positive(),
	categoryId: z.uuid(),
});

export async function createMenuItemRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/menu-items",
			{
				schema: {
					tags: ["Menu"],
					summary: "/restaurants/:slug/menu-items",
					description: "Create a new menu item for a restaurant",
					security: [{ bearerAuth: [] }],
					consumes: ["multipart/form-data"],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						201: z.object({
							itemId: z.uuid(),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const { cannot } = getUserPermissions(userId, membership.role);

				if (cannot("create", "Menu")) {
					throw new UnauthorizedError(
						"You are not authorized to create a menu item for this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to create a menu item for this restaurant."
					);
				}

				const fields: Record<string, string> = {};
				let imageUrl: string | null = null;

				for await (const part of request.parts()) {
					if (part.type === "file") {
						imageUrl = await saveMenuItemImage(part);
					} else {
						fields[part.fieldname] = part.value as string;
					}
				}

				const { name, description, price, categoryId } =
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

				const item = await prisma.menuItem.create({
					data: {
						restaurantId: restaurant.id,
						categoryId,
						name,
						description,
						priceInCents: Math.round(price * 100),
						imageUrl,
					},
				});

				return reply.status(201).send({
					itemId: item.id,
				});
			}
		);
}
