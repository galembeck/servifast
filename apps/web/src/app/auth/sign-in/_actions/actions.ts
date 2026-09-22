/** biome-ignore-all lint/suspicious/useAwait: required by server actions */

"use server";

import { HTTPError } from "ky";
import { cookies } from "next/headers";
import { z } from "zod";
import { acceptInvite } from "@/api/http/services/accept-invite";
import { signInWithPassword } from "@/api/http/services/sign-in-with-password";
import { isLikelyEmail, isValidCpf, onlyDigits } from "@/utils/cpf-validation";

const signInSchema = z.object({
	identifier: z
		.string()
		.min(1, { message: "Informe seu e-mail ou CPF" })
		.refine(
			(value) =>
				isLikelyEmail(value)
					? z.email().safeParse(value).success
					: isValidCpf(value),
			{ message: "Informe um e-mail ou CPF válido" }
		),
	password: z.string().min(1, { message: "O campo senha é obrigatório" }),
});

export async function signInWithEmailAndPassword(data: FormData) {
	const result = signInSchema.safeParse(Object.fromEntries(data));

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;

		return { success: false, title: null, description: null, errors };
	}

	const { identifier, password } = result.data;

	const normalizedIdentifier = isLikelyEmail(identifier)
		? identifier
		: onlyDigits(identifier);

	try {
		const { accessToken } = await signInWithPassword({
			identifier: normalizedIdentifier,
			password,
		});

		(await cookies()).set("accessToken", accessToken, {
			path: "/",
			maxAge: 60 * 60 * 24 * 7,
		});

		const inviteId = (await cookies()).get("inviteId")?.value;

		if (inviteId) {
			try {
				await acceptInvite(inviteId);

				(await cookies()).delete("inviteId");
				// biome-ignore lint/suspicious/noEmptyBlockStatements: already validated by the API
			} catch {}
		}
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
			title: "Houve um erro",
			description: "Tente novamente em alguns instantes.",
			errors: null,
		};
	}

	return { success: true, title: null, description: null, errors: null };
}
