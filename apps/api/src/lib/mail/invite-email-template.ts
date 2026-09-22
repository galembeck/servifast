import type { Role } from "@repo/rbac/src/types/role";

interface InviteEmailTemplateProps {
	inviterName: string;
	inviteUrl: string;
	restaurantName: string;
	role: Role;
}

const COLORS = {
	pageBackground: "#f4f1ee",
	cardBackground: "#231a15",
	cardBackgroundSoft: "#2b2019",
	cardBorder: "#3a2c22",
	accent: "#f2994a",
	accentSoft: "#3a2416",
	accentText: "#231208",
	heading: "#f7f1ec",
	body: "#c9bbb0",
	muted: "#8f8078",
};

const ROLE_LABELS: Record<Role, string> = {
	OWNER: "Proprietário(a)",
	MANAGER: "Gerente",
	WAITER: "Garçom/Garçonete",
	CASHIER: "Caixa",
	KITCHEN: "Cozinha",
	BILLING: "Financeiro",
};

function getInitial(name: string): string {
	return name.trim().charAt(0).toUpperCase() || "?";
}

export function renderInviteEmailHtml({
	inviterName,
	restaurantName,
	inviteUrl,
	role,
}: InviteEmailTemplateProps): string {
	const roleLabel = ROLE_LABELS[role];
	const inviterInitial = getInitial(inviterName);

	return `<!DOCTYPE html>
<html lang="pt-BR">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta name="color-scheme" content="light" />
		<title>Convite ServiFast</title>
	</head>
	<body
		style="margin:0;padding:0;background-color:${COLORS.pageBackground};font-family:'Segoe UI',Helvetica,Arial,sans-serif;"
	>
		<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
			${inviterName} convidou você para fazer parte de ${restaurantName} como ${roleLabel}.
		</div>

		<table
			role="presentation"
			width="100%"
			cellpadding="0"
			cellspacing="0"
			style="background-color:${COLORS.pageBackground};padding:48px 16px;"
		>
			<tr>
				<td align="center">
					<table
						role="presentation"
						width="520"
						cellpadding="0"
						cellspacing="0"
						style="max-width:520px;width:100%;"
					>
						<tr>
							<td align="center" style="padding-bottom:28px;">
								<span
									style="display:inline-block;width:10px;height:10px;border-radius:9999px;background-color:${COLORS.accent};margin-right:8px;vertical-align:middle;"
								></span>
								<span
									style="font-size:22px;font-weight:700;color:#3a2c22;vertical-align:middle;letter-spacing:-0.3px;"
								>ServiFast</span>
							</td>
						</tr>

						<tr>
							<td
								style="background-color:${COLORS.cardBackground};border:1px solid ${COLORS.cardBorder};border-radius:20px;overflow:hidden;"
							>
								<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
									<tr>
										<td style="height:5px;line-height:5px;font-size:0;background-color:${COLORS.accent};background-image:linear-gradient(90deg,#f2994a,#f5b878);">&nbsp;</td>
									</tr>
								</table>

								<div style="padding:40px 36px;">
									<table role="presentation" cellpadding="0" cellspacing="0" align="center">
										<tr>
											<td
												style="width:56px;height:56px;border-radius:9999px;background-color:${COLORS.accentSoft};border:1px solid ${COLORS.cardBorder};text-align:center;vertical-align:middle;font-size:22px;font-weight:700;color:${COLORS.accent};"
											>${inviterInitial}</td>
										</tr>
									</table>

									<p
										style="margin:20px 0 8px;font-size:13px;line-height:18px;color:${COLORS.muted};text-align:center;text-transform:uppercase;letter-spacing:0.6px;"
									>Você recebeu um convite</p>

									<p
										style="margin:0 0 28px;font-size:18px;line-height:27px;color:${COLORS.body};text-align:center;"
									>
										<strong style="color:${COLORS.heading};">${inviterName}</strong>
										convidou você para fazer parte de
										<strong style="color:${COLORS.heading};">${restaurantName}</strong>
										no ServiFast.
									</p>

									<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-bottom:28px;">
										<tr>
											<td
												style="background-color:${COLORS.accentSoft};border:1px solid ${COLORS.cardBorder};border-radius:9999px;padding:6px 18px;font-size:13px;font-weight:600;color:${COLORS.accent};"
											>Função: ${roleLabel}</td>
										</tr>
									</table>

									<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
										<tr>
											<td align="center" style="padding-bottom:20px;">
												<a
													href="${inviteUrl}"
													style="display:inline-block;background-color:${COLORS.accent};color:${COLORS.accentText};font-size:15px;font-weight:700;text-decoration:none;padding:15px 36px;border-radius:10px;"
												>Criar minha conta</a>
											</td>
										</tr>
									</table>

									<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
										<tr>
											<td style="border-top:1px solid ${COLORS.cardBorder};padding-top:20px;">
												<p
													style="margin:0;font-size:13px;line-height:20px;color:${COLORS.muted};text-align:center;"
												>
													Ou copie e cole este link no seu navegador:<br />
													<a href="${inviteUrl}" style="color:${COLORS.accent};word-break:break-all;">${inviteUrl}</a>
												</p>
											</td>
										</tr>
									</table>
								</div>
							</td>
						</tr>

						<tr>
							<td style="padding-top:28px;">
								<p
									style="margin:0 0 4px;font-size:12px;line-height:18px;color:#a79b8f;text-align:center;"
								>
									Se você não esperava este e-mail, pode ignorá-lo com segurança.
								</p>
								<p
									style="margin:0;font-size:12px;line-height:18px;color:#c4b9ae;text-align:center;"
								>
									ServiFast · Gestão de restaurantes
								</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;
}
