import type { Role } from "@repo/rbac/src/types/role";
import { api } from "../api-client";

interface CreateInviteRequest {
	email: string;
	restaurant: string;
	role: Role;
}

export async function createInvite({
	restaurant,
	email,
	role,
}: CreateInviteRequest) {
	await api.post(`restaurants/${restaurant}/invites`, {
		json: {
			email,
			role,
		},
	});
}
