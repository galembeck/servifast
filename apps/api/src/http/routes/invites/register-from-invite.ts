import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { BusinessException } from "@/http/_errors/exceptions/business/business";
import { UserException } from "@/http/_errors/exceptions/user";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";

const MIN_PASSWORD_LENGTH = 6;

// biome-ignore lint/suspicious/useAwait: required by @fastify
export async function registerFromInviteRoute(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/invites/:inviteId/register",
		{
			schema: {
				tags: ["Invites"],
				summary: "/invites/:inviteId/register",
				description:
					"Create an account for an invited e-mail and accept the invite",
				params: z.object({
					inviteId: z.uuid(),
				}),
				body: z.object({
					name: z.string().min(1),
					cpf: z.string().min(1),
					password: z.string().min(MIN_PASSWORD_LENGTH),
				}),
				response: {
					201: z.object({
						accessToken: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			const { inviteId } = request.params;
			const { name, cpf, password } = request.body;

			const invite = await prisma.invite.findUnique({
				where: { id: inviteId },
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
			});

			if (userWithSameEmail) {
				throw new BadRequestError(
					"E-mail already registered.",
					UserException.EMAIL_ALREADY_REGISTERED,
					"There is already an account for this e-mail. Sign in to accept the invite instead."
				);
			}

			const digitsOnlyCpf = onlyDigits(cpf);

			if (!isValidCpf(digitsOnlyCpf)) {
				throw new BadRequestError(
					"Invalid CPF.",
					UserException.INVALID_CPF,
					"Enter a valid CPF."
				);
			}

			const userWithSameCpf = await prisma.user.findUnique({
				where: { cpf: digitsOnlyCpf },
			});

			if (userWithSameCpf) {
				throw new BadRequestError(
					"CPF already registered.",
					UserException.CPF_ALREADY_REGISTERED,
					"There is already an account registered with this CPF."
				);
			}

			const passwordHash = await hash(password, 6);
			const userId = randomUUID();

			await prisma.$transaction([
				prisma.user.create({
					data: {
						id: userId,
						name,
						email: invite.email,
						cpf: digitsOnlyCpf,
						passwordHash,
					},
				}),
				prisma.member.create({
					data: {
						userId,
						restaurantId: invite.restaurantId,
						role: invite.role,
					},
				}),
				prisma.invite.delete({
					where: { id: invite.id },
				}),
			]);

			const accessToken = await reply.jwtSign(
				{
					sub: userId,
				},
				{
					sign: {
						expiresIn: "7d",
					},
				}
			);

			return reply.status(201).send({ accessToken });
		}
	);
}
