/** biome-ignore-all lint/suspicious/useAwait: required by @fastify */

import { roleSchema } from "@repo/rbac/src/types/role";
import { getUserPermissions } from "@repo/rbac/src/utils/get-user-permissions";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { InviteException } from "@/http/_errors/exceptions/invite";
import { RestaurantException } from "@/http/_errors/exceptions/restaurant";
import { auth } from "@/http/middlewares/auth";
import { sendInviteEmail } from "@/lib/mail/send-invite-email";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function createInviteRoute(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/restaurants/:slug/invites",
			{
				schema: {
					tags: ["Invites"],
					summary: "/restaurants/:slug/invites",
					description: "Create a new invite for an restaurant",
					security: [{ bearerAuth: [] }],
					body: z.object({
						email: z.email(),
						role: roleSchema,
					}),
					params: z.object({
						slug: z.string(),
					}),
					response: {
						201: z.object({
							inviteId: z.uuid(),
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

				if (cannot("create", "Invite")) {
					throw new UnauthorizedError(
						"You are not authorized to create an invite for this restaurant.",
						AuthException.UNAUTHORIZED,
						"User must have enough permission(s) in order to create an invite for this restaurant."
					);
				}

				const { email, role } = request.body;

				const [_, domain] = email.split("@");

				if (
					restaurant.shouldAttachUsersByDomain &&
					restaurant.domain === domain
				) {
					throw new BadRequestError(
						"Automatically attaching users to your restaurant.",
						RestaurantException.AUTOMATICALLY_ATTACHING_USERS,
						`Users with "${domain}" domain will join your restaurant automatically on login.`
					);
				}

				const inviteWithSameEmail = await prisma.invite.findUnique({
					where: {
						email_restaurantId: {
							email,
							restaurantId: restaurant.id,
						},
					},
				});

				if (inviteWithSameEmail) {
					throw new BadRequestError(
						"Invite already exists for this email.",
						InviteException.INVITE_ALREADY_EXISTS,
						"Another invite with the same e-mail already exists for this restaurant."
					);
				}

				const memberWithSameEmail = await prisma.member.findFirst({
					where: {
						restaurantId: restaurant.id,
						user: {
							email,
						},
					},
				});

				if (memberWithSameEmail) {
					throw new BadRequestError(
						"Member already exists in this restaurant.",
						RestaurantException.MEMBER_ALREADY_EXISTS,
						"There is already a member with this e-mail registered in this restaurant."
					);
				}

				const invite = await prisma.invite.create({
					data: {
						restaurantId: restaurant.id,
						email,
						role,
						authorId: userId,
					},
					include: {
						author: {
							select: { name: true },
						},
					},
				});

				try {
					await sendInviteEmail({
						to: email,
						inviterName: invite.author?.name ?? "Alguém",
						restaurantName: restaurant.name,
						role,
						inviteId: invite.id,
					});
				} catch (error) {
					request.log.warn(
						{ error, inviteId: invite.id },
						"Failed to send invite e-mail"
					);
				}

				return reply.status(201).send({
					inviteId: invite.id,
				});
			}
		);
}
