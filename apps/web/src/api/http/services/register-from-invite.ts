import { api } from "../api-client";

interface RegisterFromInviteRequest {
	cpf: string;
	inviteId: string;
	name: string;
	password: string;
}

interface RegisterFromInviteResponse {
	accessToken: string;
}

export async function registerFromInvite({
	inviteId,
	name,
	cpf,
	password,
}: RegisterFromInviteRequest) {
	const result = await api
		.post(`invites/${inviteId}/register`, {
			json: {
				name,
				cpf,
				password,
			},
		})
		.json<RegisterFromInviteResponse>();

	return result;
}
