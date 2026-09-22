import { api } from "../api-client";

interface DeleteProjectRequest {
	projectId: string;
	restaurant: string;
}

export async function DeleteProject({
	restaurant,
	projectId,
}: DeleteProjectRequest) {
	await api.delete(`restaurants/${restaurant}/projects/${projectId}`);
}
