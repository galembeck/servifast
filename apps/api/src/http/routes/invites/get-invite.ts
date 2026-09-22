/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { roleSchema } from "@repo/rbac/src/types/role";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { BusinessException } from "@/http/_errors/exceptions/business/business";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";

export async function getInviteRoute(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/invites/:inviteId",
		{
			schema: {
				tags: ["Invites"],
				summary: "/invites/:inviteId",
				description: "Get an invite details by its ID",
				params: z.object({
					inviteId: z.uuid(),
				}),
				response: {
					200: z.object({
						invite: z.object({
							id: z.uuid(),
							role: roleSchema,
							email: z.email(),
							createdAt: z.date(),
							restaurant: z.object({
								name: z.string(),
								slug: z.string(),
							}),
							author: z
								.object({
									id: z.uuid(),
									name: z.string().nullable(),
									avatarUrl: z.url().nullable(),
								})
								.nullable(),
							emailHasAccount: z.boolean(),
						}),
					}),
				},
			},
		},
		async (request, reply) => {
			const { inviteId } = request.params;

			const invite = await prisma.invite.findUnique({
				where: {
					id: inviteId,
				},
				select: {
					id: true,
					email: true,
					role: true,
					createdAt: true,
					author: {
						select: {
							id: true,
							name: true,
							avatarUrl: true,
						},
					},
					restaurant: {
						select: {
							name: true,
							slug: true,
						},
					},
				},
			});

			if (!invite) {
				throw new BadRequestError(
					"Invite not found.",
					BusinessException.NOT_FOUND,
					"The invite with the specified ID was not found."
				);
			}

			const userWithSameEmail = await prisma.user.findUnique({
				where: { email: invite.email },
				select: { id: true },
			});

			return reply.status(200).send({
				invite: { ...invite, emailHasAccount: userWithSameEmail !== null },
			});
		}
	);
}
