import { api } from "../api-client";

interface RevokeInviteRequest {
	inviteId: string;
	restaurant: string;
}

export async function revokeInvite({
	restaurant,
	inviteId,
}: RevokeInviteRequest) {
	await api.delete(`restaurants/${restaurant}/invites/${inviteId}`);
}
