import { api } from "../api-client";

interface RemoveMemberRequest {
	memberId: string;
	restaurant: string;
}

export async function removeMember({
	restaurant,
	memberId,
}: RemoveMemberRequest) {
	await api.delete(`restaurants/${restaurant}/members/${memberId}`);
}
