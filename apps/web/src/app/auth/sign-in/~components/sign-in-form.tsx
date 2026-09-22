"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ChangeEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormState } from "@/hooks/use-form-state";
import { formatCpf } from "@/utils/cpf-validation";
import { signInWithEmailAndPassword } from "../_actions/actions";

const CONTAINS_LETTER_REGEX = /[a-zA-Z]/;

function handleIdentifierChange(event: ChangeEvent<HTMLInputElement>) {
	const { value } = event.target;

	if (!CONTAINS_LETTER_REGEX.test(value)) {
		event.target.value = formatCpf(value);
	}
}

export function SignInForm() {
	const router = useRouter();

	const searchParams = useSearchParams();

	const [{ success, title, description, errors }, handleSignIn, isPending] =
		useFormState(signInWithEmailAndPassword, () => {
			router.push("/");
		});

	return (
		<form className="space-y-4" onSubmit={handleSignIn}>
			{success === false && (title ?? description) && (
				<Alert variant="destructive">
					<AlertTriangle className="size-4" />

					<AlertTitle>{title ?? "Ocorreu um erro!"}</AlertTitle>

					{description && (
						<AlertDescription>
							<p>{description}</p>
						</AlertDescription>
					)}
				</Alert>
			)}

			<div className="space-y-3">
				<Label htmlFor="identifier">E-mail ou CPF</Label>

				<Input
					defaultValue={searchParams.get("identifier") ?? ""}
					id="identifier"
					name="identifier"
					onChange={handleIdentifierChange}
					placeholder="seu@email.com ou 000.000.000-00"
				/>

				{errors?.identifier && (
					<p className="font-medium text-destructive text-xs">
						{errors.identifier[0]}
					</p>
				)}
			</div>

			<div className="space-y-3">
				<Label htmlFor="password">Senha</Label>

				<Input
					id="password"
					name="password"
					placeholder="••••••"
					type="password"
				/>

				{errors?.password && (
					<p className="font-medium text-destructive text-xs">
						{errors.password[0]}
					</p>
				)}

				<Link
					className="font-medium text-muted-foreground text-xs hover:text-primary hover:underline"
					href="/auth/forgot-password"
				>
					Esqueceu sua senha?
				</Link>
			</div>

			<Button className="w-full" disabled={isPending} type="submit">
				{isPending ? (
					<span className="flex items-center gap-2">
						<Loader2 className="size-4 animate-spin" />
						Autenticando...
					</span>
				) : (
					"Autenticar"
				)}
			</Button>
		</form>
	);
}
