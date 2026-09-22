import type { Role } from "@repo/rbac/src/types/role";
import { api } from "../api-client";

interface UpdateMemberRequest {
	memberId: string;
	restaurant: string;
	role: Role;
}

export async function updateMember({
	restaurant,
	memberId,
	role,
}: UpdateMemberRequest) {
	await api.put(`restaurants/${restaurant}/members/${memberId}`, {
		json: {
			role,
		},
	});
}
