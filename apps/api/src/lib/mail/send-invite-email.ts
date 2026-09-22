import { env } from "@repo/env";
import type { Role } from "@repo/rbac/src/types/role";
import { renderInviteEmailHtml } from "@/lib/mail/invite-email-template";
import { resend } from "@/lib/resend";

interface SendInviteEmailParams {
	inviteId: string;
	inviterName: string;
	restaurantName: string;
	role: Role;
	to: string;
}

export async function sendInviteEmail({
	to,
	inviterName,
	restaurantName,
	role,
	inviteId,
}: SendInviteEmailParams) {
	if (!resend) {
		console.warn("RESEND_API_KEY is not set — skipping invite e-mail to", to);
		return;
	}

	const inviteUrl = new URL(`/invite/${inviteId}`, env.WEB_URL).toString();

	await resend.emails.send({
		from: `ServiFast <${env.RESEND_FROM_EMAIL}>`,
		to,
		subject: `${inviterName} convidou você para ${restaurantName}`,
		html: renderInviteEmailHtml({
			inviterName,
			restaurantName,
			inviteUrl,
			role,
		}),
	});
}
