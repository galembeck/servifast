import { fastifyCors } from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { fastify } from "fastify";
import {
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { errorHandler } from "@/http/error-handler";
import { authenticateWithPasswordRoute } from "@/http/routes/auth/authenticate-with-password";
import { requestPasswordRecoveryRoute } from "@/http/routes/auth/request-password-recovery";
import { resetPasswordRoute } from "@/http/routes/auth/reset-password";
import { getBillingRoute } from "@/http/routes/billing/get-billing";
import { acceptInviteRoute } from "@/http/routes/invites/accept-invite";
import { createInviteRoute } from "@/http/routes/invites/create-invite";
import { getInviteRoute } from "@/http/routes/invites/get-invite";
import { getInvitesRoute } from "@/http/routes/invites/get-invites";
import { getPendingInvitesRoute } from "@/http/routes/invites/get-pending-invites";
import { registerFromInviteRoute } from "@/http/routes/invites/register-from-invite";
import { rejectInviteRoute } from "@/http/routes/invites/reject-invite";
import { revokeInviteRoute } from "@/http/routes/invites/revoke-invite";
import { getMembersRoute } from "@/http/routes/members/get-members";
import { removeMemberRoute } from "@/http/routes/members/remove-member";
import { updateMemberRoute } from "@/http/routes/members/update-member";
import { createProjectRoute } from "@/http/routes/projects/create-project";
import { deleteProjectRoute } from "@/http/routes/projects/delete-project";
import { getProjectRoute } from "@/http/routes/projects/get-project";
import { getProjectsRoute } from "@/http/routes/projects/get-projects";
import { updateProjectRoute } from "@/http/routes/projects/update-project";
import { createRestaurantRoute } from "@/http/routes/restaurants/create-restaurant";
import { deleteRestaurantRoute } from "@/http/routes/restaurants/delete-restaurant";
import { getMembershipRoute } from "@/http/routes/restaurants/get-membership";
import { getRestaurantRoute } from "@/http/routes/restaurants/get-restaurant";
import { getRestaurantsRoute } from "@/http/routes/restaurants/get-restaurants";
import { transferOwnershipRoute } from "@/http/routes/restaurants/transfer-ownership";
import { updateRestaurantRoute } from "@/http/routes/restaurants/update-restaurant";
import { createAccountRoute } from "@/http/routes/user/create-account";
import { getProfileRoute } from "@/http/routes/user/get-profile";

export async function buildApp() {
	const app = fastify().withTypeProvider<ZodTypeProvider>();

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	app.setErrorHandler(errorHandler);

	await app.register(fastifyJwt, {
		secret: process.env.JWT_SECRET ?? "test-secret",
	});
	await app.register(fastifyCors);

	await app.register(createAccountRoute);
	await app.register(authenticateWithPasswordRoute);
	await app.register(requestPasswordRecoveryRoute);
	await app.register(resetPasswordRoute);
	await app.register(getProfileRoute);
	await app.register(createRestaurantRoute);
	await app.register(getMembershipRoute);
	await app.register(getRestaurantRoute);
	await app.register(getRestaurantsRoute);
	await app.register(updateRestaurantRoute);
	await app.register(deleteRestaurantRoute);
	await app.register(transferOwnershipRoute);
	await app.register(acceptInviteRoute);
	await app.register(createInviteRoute);
	await app.register(getInviteRoute);
	await app.register(getInvitesRoute);
	await app.register(registerFromInviteRoute);
	await app.register(getPendingInvitesRoute);
	await app.register(rejectInviteRoute);
	await app.register(revokeInviteRoute);
	await app.register(getMembersRoute);
	await app.register(updateMemberRoute);
	await app.register(removeMemberRoute);
	await app.register(createProjectRoute);
	await app.register(deleteProjectRoute);
	await app.register(getProjectRoute);
	await app.register(getProjectsRoute);
	await app.register(updateProjectRoute);
	await app.register(getBillingRoute);

	await app.ready();

	return app;
}
