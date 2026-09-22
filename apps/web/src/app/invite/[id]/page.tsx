import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { ArrowLeft, CheckCircle, LogIn, LogOut } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptInvite } from "@/api/http/services/accept-invite";
import { getInvite } from "@/api/http/services/get-invite";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { auth, isAuthenticated } from "@/providers/auth-provider";
import { getInitials } from "@/utils/get-initials";
import { RegisterForm } from "./~components/register-form";

dayjs.extend(relativeTime);

interface InvitePageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function InvitePage({ params }: InvitePageProps) {
	const { id: inviteId } = await params;

	const { invite } = await getInvite(inviteId);

	const isUserAuthenticated = await isAuthenticated();

	// biome-ignore lint/suspicious/noEvolvingTypes: necessary in this case
	let currentUserEmail = null;

	if (isUserAuthenticated) {
		const { user } = await auth();

		currentUserEmail = user.email;
	}

	const userIsAuthenticatedWithSameEmailFromInvite =
		currentUserEmail === invite.email;

	async function signInFromInvite() {
		"use server";

		(await cookies()).set("inviteId", inviteId);

		redirect(`/auth/sign-in?identifier=${invite.email}`);
	}

	async function acceptInviteAction() {
		"use server";

		await acceptInvite(inviteId);

		redirect(`/restaurant/${invite.restaurant.slug}`);
	}

	return (
		<div className="flex flex-col justify-center space-y-6">
			<div className="flex flex-col items-center space-y-4">
				<Avatar className="size-16">
					{invite.author?.avatarUrl && (
						<AvatarImage src={invite.author.avatarUrl} />
					)}

					{invite.author?.name && (
						<AvatarFallback>{getInitials(invite.author?.name)}</AvatarFallback>
					)}
				</Avatar>

				<p className="text-balance text-center text-muted-foreground leading-relaxed">
					<span className="font-medium text-foreground">
						{invite.author?.name ?? "Alguém"}
					</span>{" "}
					convidou você para se juntar a{" "}
					<span className="font-medium text-foreground">
						{invite.restaurant.name}
					</span>
					. <span className="text-xs">{dayjs(invite.createdAt).fromNow()}</span>
				</p>
			</div>

			<Separator />

			{!(isUserAuthenticated || invite.emailHasAccount) && (
				<RegisterForm
					email={invite.email}
					inviteId={inviteId}
					restaurantSlug={invite.restaurant.slug}
				/>
			)}

			{!isUserAuthenticated && invite.emailHasAccount && (
				<form action={signInFromInvite}>
					<Button className="w-full" type="submit" variant="secondary">
						<LogIn className="mr-2 size-4" />
						Entrar para aceitar o convite
					</Button>
				</form>
			)}

			{userIsAuthenticatedWithSameEmailFromInvite && (
				<form action={acceptInviteAction}>
					<Button className="w-full" type="submit">
						<CheckCircle className="mr-2 size-4" />
						Entrar em {invite.restaurant.name}
					</Button>
				</form>
			)}

			{isUserAuthenticated && !userIsAuthenticatedWithSameEmailFromInvite && (
				<div className="space-y-8">
					<p className="text-balance text-center text-muted-foreground text-sm leading-relaxed">
						Este convite foi enviado para{" "}
						<span className="text-foreground text-medium">{invite.email}</span>{" "}
						mas você está conectado como{" "}
						<span className="text-foreground text-medium">
							{currentUserEmail}
						</span>
						.
					</p>

					<div className="flex items-center justify-center gap-2">
						<Button asChild variant="secondary">
							<a href="/api/auth/sign-out">
								<LogOut className="mr-2 size-4" />
								Sair
							</a>
						</Button>

						<Button asChild variant="outline">
							<Link href="/">
								<ArrowLeft className="mr-2 size-4" />
								Voltar ao painel
							</Link>
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
