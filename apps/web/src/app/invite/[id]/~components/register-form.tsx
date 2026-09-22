"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormState } from "@/hooks/use-form-state";
import { formatCpf } from "@/utils/cpf-validation";
import { registerFromInviteAction } from "../~actions/actions";

interface RegisterFormProps {
	email: string;
	inviteId: string;
	restaurantSlug: string;
}

function handleCpfChange(event: ChangeEvent<HTMLInputElement>) {
	event.target.value = formatCpf(event.target.value);
}

export function RegisterForm({
	inviteId,
	email,
	restaurantSlug,
}: RegisterFormProps) {
	const router = useRouter();

	const boundAction = registerFromInviteAction.bind(null, inviteId);

	const [{ success, title, description, errors }, handleRegister, isPending] =
		useFormState(boundAction, () => {
			router.push(`/restaurant/${restaurantSlug}`);
		});

	return (
		<form className="space-y-4" onSubmit={handleRegister}>
			{success === false && (title ?? description) && (
				<Alert variant="destructive">
					<AlertTriangle className="size-4" />

					<AlertTitle>{title ?? "Erro ao criar conta!"}</AlertTitle>

					{description && (
						<AlertDescription>
							<p>{description}</p>
						</AlertDescription>
					)}
				</Alert>
			)}

			<div className="space-y-3">
				<Label htmlFor="name">Nome completo</Label>

				<Input id="name" name="name" placeholder="Seu nome completo" />

				{errors?.name && (
					<p className="font-medium text-destructive text-xs">
						{errors.name[0]}
					</p>
				)}
			</div>

			<div className="space-y-3">
				<Label htmlFor="email">E-mail</Label>

				<Input defaultValue={email} disabled id="email" readOnly />
			</div>

			<div className="space-y-3">
				<Label htmlFor="cpf">CPF</Label>

				<Input
					id="cpf"
					name="cpf"
					onChange={handleCpfChange}
					placeholder="000.000.000-00"
				/>

				{errors?.cpf && (
					<p className="font-medium text-destructive text-xs">
						{errors.cpf[0]}
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
			</div>

			<div className="space-y-3">
				<Label htmlFor="password_confirmation">Confirmar senha</Label>

				<Input
					id="password_confirmation"
					name="password_confirmation"
					placeholder="••••••"
					type="password"
				/>

				{errors?.password_confirmation && (
					<p className="font-medium text-destructive text-xs">
						{errors.password_confirmation[0]}
					</p>
				)}
			</div>

			<Button className="w-full" disabled={isPending} type="submit">
				{isPending ? (
					<span className="flex items-center gap-2">
						<Loader2 className="size-4 animate-spin" />
						Criando conta...
					</span>
				) : (
					"Criar conta"
				)}
			</Button>
		</form>
	);
}
