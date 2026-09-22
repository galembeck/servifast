"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormState } from "@/hooks/use-form-state";
import {
	createRestaurantAction,
	type RestaurantSchema,
	updateRestaurantAction,
} from "../~actions/actions";

interface RestaurantFormProps {
	initialData?: RestaurantSchema;
	isUpdating?: boolean;
}

export function RestaurantForm({
	isUpdating = false,
	initialData,
}: RestaurantFormProps) {
	const formAction = isUpdating
		? updateRestaurantAction
		: createRestaurantAction;

	const [
		{ success, title, description, errors },
		handleSaveRestaurant,
		isPending,
	] = useFormState(formAction);

	return (
		<form className="space-y-4" onSubmit={handleSaveRestaurant}>
			{success === false && (title ?? description) && (
				<Alert variant="destructive">
					<AlertTriangle className="size-4" />

					<AlertTitle>{title ?? "Erro ao salvar restaurante!"}</AlertTitle>

					{description && (
						<AlertDescription>
							<p>{description}</p>
						</AlertDescription>
					)}
				</Alert>
			)}

			{success === true && (title ?? description) && (
				<Alert variant="success">
					<AlertTriangle className="size-4" />

					<AlertTitle>{title}</AlertTitle>

					{description && (
						<AlertDescription>
							<p>{description}</p>
						</AlertDescription>
					)}
				</Alert>
			)}

			<div className="space-y-3">
				<Label htmlFor="name">Nome do restaurante</Label>

				<Input defaultValue={initialData?.name} id="name" name="name" />

				{errors?.name && (
					<p className="font-medium text-red-500 text-xs dark:text-red-400">
						{errors.name[0]}
					</p>
				)}
			</div>

			<div className="space-y-3">
				<Label htmlFor="domain">Domínio de e-mail</Label>

				<Input
					defaultValue={initialData?.domain ?? undefined}
					id="domain"
					inputMode="url"
					name="domain"
					placeholder="example.com"
				/>

				{errors?.domain && (
					<p className="font-medium text-red-500 text-xs dark:text-red-400">
						{errors.domain[0]}
					</p>
				)}
			</div>

			<div className="space-y-3">
				<div className="flex items-baseline space-x-2">
					<Checkbox
						className="translate-y-0.5"
						defaultChecked={initialData?.shouldAttachUsersByDomain}
						id="shouldAttachUsersByDomain"
						name="shouldAttachUsersByDomain"
					/>

					<label className="space-y-1" htmlFor="shouldAttachUsersByDomain">
						<span className="font-medium text-sm leading-none">
							Adicionar usuários automaticamente pelo domínio
						</span>

						<p className="text-muted-foreground text-sm">
							Isso convidará automaticamente todos os usuários com um e-mail que
							corresponda ao domínio do restaurante.
						</p>
					</label>
				</div>

				{errors?.shouldAttachUsersByDomain && (
					<p className="font-medium text-red-500 text-xs dark:text-red-400">
						{errors.shouldAttachUsersByDomain[0]}
					</p>
				)}
			</div>

			<Button className="w-full" disabled={isPending} type="submit">
				{isPending ? (
					<span className="flex items-center gap-2">
						<Loader2 className="size-4 animate-spin" />
						Salvando...
					</span>
				) : (
					"Salvar restaurante"
				)}
			</Button>
		</form>
	);
}
