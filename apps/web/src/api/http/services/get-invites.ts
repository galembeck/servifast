import type { Role } from "@repo/rbac/src/types/role";
import { api } from "../api-client";

interface GetInvitesResponse {
	invites: {
		id: string;
		role: Role;
		email: string;
		createdAt: string;
		author: {
			id: string;
			name: string | null;
			email: string;
		} | null;
	}[];
}

export async function getInvites(restaurantSlug: string) {
	const result = await api
		.get(`restaurants/${restaurantSlug}/invites`, {
			next: {
				tags: [`${restaurantSlug}/invites`],
			},
		})
		.json<GetInvitesResponse>();

	return result;
}
