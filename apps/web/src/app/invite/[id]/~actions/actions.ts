/** biome-ignore-all lint/suspicious/useAwait: required by server actions */

"use server";

import { HTTPError } from "ky";
import { cookies } from "next/headers";
import { z } from "zod";
import { registerFromInvite } from "@/api/http/services/register-from-invite";
import { isValidCpf, onlyDigits } from "@/utils/cpf-validation";

const registerFromInviteSchema = z
	.object({
		name: z.string().min(1, { message: "Informe seu nome" }),
		cpf: z.string().refine(isValidCpf, { message: "Informe um CPF válido" }),
		password: z.string().min(6, {
			message: "A senha deve ter pelo menos 6 caracteres",
		}),
		password_confirmation: z.string(),
	})
	.refine((data) => data.password === data.password_confirmation, {
		message: "A confirmação de senha não corresponde",
		path: ["password_confirmation"],
	});

export async function registerFromInviteAction(
	inviteId: string,
	data: FormData
) {
	const result = registerFromInviteSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;

		return { success: false, title: null, description: null, errors };
	}

	const { name, cpf, password } = result.data;

	try {
		const { accessToken } = await registerFromInvite({
			inviteId,
			name,
			cpf: onlyDigits(cpf),
			password,
		});

		(await cookies()).set("accessToken", accessToken, {
			path: "/",
			maxAge: 60 * 60 * 24 * 7,
		});
	} catch (error) {
		if (error instanceof HTTPError) {
			const { title, description } = error.data as {
				title: string | null;
				description: string | null;
			};

			return {
				success: false,
				title,
				description,
				errors: null,
			};
		}

		return {
			success: false,
			title: "Erro inesperado",
			description: "Tente novamente em alguns minutos.",
			errors: null,
		};
	}

	return { success: true, title: null, description: null, errors: null };
}
