"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormState } from "@/hooks/use-form-state";
import { signUpAction } from "../_actions/actions";

export function SignUpForm() {
	const router = useRouter();

	const [{ success, title, description, errors }, handleSignUp, isPending] =
		useFormState(signUpAction, () => {
			router.push("/");
		});

	return (
		<div className="space-y-4">
			<form className="space-y-4" onSubmit={handleSignUp}>
				{success === false && (title ?? description) && (
					<Alert variant="destructive">
						<AlertTriangle className="size-4" />

						<AlertTitle>{title ?? "Sign up failed!"}</AlertTitle>

						{description && (
							<AlertDescription>
								<p>{description}</p>
							</AlertDescription>
						)}
					</Alert>
				)}

				<div className="space-y-3">
					<Label htmlFor="name">Name</Label>

					<Input id="name" name="name" placeholder="John Doe" />

					{errors?.name && (
						<p className="font-medium text-red-500 text-xs dark:text-red-400">
							{errors.name[0]}
						</p>
					)}
				</div>

				<div className="space-y-3">
					<Label htmlFor="email">E-mail</Label>

					<Input
						id="email"
						name="email"
						placeholder="your@email.com"
						type="email"
					/>

					{errors?.email && (
						<p className="font-medium text-red-500 text-xs dark:text-red-400">
							{errors.email[0]}
						</p>
					)}
				</div>

				<div className="space-y-3">
					<Label htmlFor="password">Password</Label>

					<Input
						id="password"
						name="password"
						placeholder="••••••"
						type="password"
					/>

					{errors?.password && (
						<p className="font-medium text-red-500 text-xs dark:text-red-400">
							{errors.password[0]}
						</p>
					)}
				</div>

				<div className="space-y-3">
					<Label htmlFor="password_confirmation">Confirm password</Label>

					<Input
						id="password_confirmation"
						name="password_confirmation"
						placeholder="••••••"
						type="password"
					/>

					{errors?.password_confirmation && (
						<p className="font-medium text-red-500 text-xs dark:text-red-400">
							{errors.password_confirmation[0]}
						</p>
					)}
				</div>

				<Button className="w-full" disabled={isPending} type="submit">
					{isPending ? (
						<span className="flex items-center gap-2">
							<Loader2 className="size-4 animate-spin" />
							Creating account...
						</span>
					) : (
						"Create account"
					)}
				</Button>

				<Button asChild className="w-full" variant="link">
					<Link href="/auth/sign-in">Already registered? Sign in</Link>
				</Button>
			</form>
		</div>
	);
}
