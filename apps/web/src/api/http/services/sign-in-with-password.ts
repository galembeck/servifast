import { api } from "../api-client";

interface SignInWithPasswordRequest {
	identifier: string;
	password: string;
}

interface SignInWithPasswordResponse {
	accessToken: string;
}

export async function signInWithPassword({
	identifier,
	password,
}: SignInWithPasswordRequest) {
	const result = await api
		.post("sessions/password", {
			json: {
				identifier,
				password,
			},
		})
		.json<SignInWithPasswordResponse>();

	return result;
}
