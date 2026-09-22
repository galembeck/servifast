/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { projectSchema } from "@repo/rbac/src/models/project.model";
import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { BusinessException } from "@/http/_errors/exceptions/business/business";
import { auth } from "@/http/middlewares/auth";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function deleteProjectRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.delete(
			"/restaurants/:slug/projects/:projectId",
			{
				schema: {
					tags: ["Projects"],
					summary: "/restaurants/:slug/projects/:projectId",
					description: "Delete a project inside an restaurant",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						projectId: z.uuid(),
					}),
				},
			},
			async (request, reply) => {
				const { slug, projectId } = request.params;

				const userId = await request.getCurrentUserId();
				const { restaurant, membership } =
					await request.getUserMembership(slug);

				const project = await prisma.project.findUnique({
					where: {
						id: projectId,
						restaurantId: restaurant.id,
					},
				});

				if (!project) {
					throw new BadRequestError(
						"Project not found in this restaurant.",
						BusinessException.NOT_FOUND,
						"A valid and existing project ID is required to delete a project in an restaurant."
					);
				}

				const { cannot } = getUserPermissions(userId, membership.role);

				const authProject = projectSchema.parse(project);

				if (cannot("delete", authProject)) {
					throw new UnauthorizedError(
						"You are not authorized to delete this project.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to delete this project."
					);
				}

				await prisma.project.delete({
					where: {
						id: projectId,
					},
				});

				return reply.status(204).send();
			}
		);
}
