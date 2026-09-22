import { compare } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuthException } from "@/http/_errors/exceptions/auth";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";

const EMAIL_SCHEMA = z.email();

async function findUserByIdentifier(identifier: string) {
	if (identifier.includes("@")) {
		if (!EMAIL_SCHEMA.safeParse(identifier).success) {
			throw new BadRequestError(
				"Identificador inválido",
				AuthException.INVALID_IDENTIFIER,
				"Informe um endereço de e-mail ou CPF válido."
			);
		}

		return await prisma.user.findUnique({ where: { email: identifier } });
	}

	const cpf = onlyDigits(identifier);

	if (!isValidCpf(cpf)) {
		throw new BadRequestError(
			"Identificador inválido",
			AuthException.INVALID_IDENTIFIER,
			"Informe um endereço de e-mail ou CPF válido."
		);
	}

	return await prisma.user.findUnique({ where: { cpf } });
}

// biome-ignore lint/suspicious/useAwait: required by @fastify
export async function authenticateWithPasswordRoute(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/sessions/password",
		{
			schema: {
				tags: ["Auth"],
				summary: "/sessions/password",
				description: "Authenticate with e-mail/CPF & password",
				body: z.object({
					identifier: z.string().min(1),
					password: z.string(),
				}),
				response: {
					200: z.object({
						accessToken: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			const { identifier, password } = request.body;

			const user = await findUserByIdentifier(identifier);

			if (!user) {
				throw new BadRequestError(
					"Credenciais inválidas",
					AuthException.INVALID_CREDENTIALS,
					"O e-mail/CPF ou senha estão incorretos."
				);
			}

			if (user.passwordHash === null) {
				throw new BadRequestError(
					"Credenciais inválidas",
					AuthException.USER_HAS_NO_PASSWORD,
					"O usuário não possui uma senha definida. Utilize o fluxo de 'esqueci minha senha' para redefiní-la."
				);
			}

			const isPasswordValid = await compare(password, user.passwordHash);

			if (!isPasswordValid) {
				throw new BadRequestError(
					"Credenciais inválidas",
					AuthException.INVALID_CREDENTIALS,
					"O e-mail/CPF ou senha estão incorretos."
				);
			}

			const accessToken = await reply.jwtSign(
				{
					sub: user.id,
				},
				{
					sign: {
						expiresIn: "7d",
					},
				}
			);

			return reply.status(200).send({ accessToken });
		}
	);
}
