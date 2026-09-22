import type { Role } from "@repo/rbac/src/types/role";
import { api } from "../api-client";

interface GetMembershipResponse {
	membership: {
		id: string;
		role: Role;
		userId: string;
		restaurantId: string;
	};
}

export async function getMembership(slug: string) {
	const result = await api
		.get(`restaurants/${slug}/membership`)
		.json<GetMembershipResponse>();

	return result;
}
