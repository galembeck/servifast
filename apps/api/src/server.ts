import path from "node:path";
import "dotenv/config";
import { fastifyCors } from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { fastifyMultipart } from "@fastify/multipart";
import { fastifyStatic } from "@fastify/static";
import { fastifySwagger } from "@fastify/swagger";
import { env } from "@repo/env";
import ScalarApiReference from "@scalar/fastify-api-reference";
import { fastify } from "fastify";
import {
	jsonSchemaTransform,
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { errorHandler } from "./http/error-handler";
import { authenticateWithPasswordRoute } from "./http/routes/auth/authenticate-with-password";
import { requestPasswordRecoveryRoute } from "./http/routes/auth/request-password-recovery";
import { resetPasswordRoute } from "./http/routes/auth/reset-password";
import { createExpenseRoute } from "./http/routes/billing/create-expense";
import { getBillingRoute } from "./http/routes/billing/get-billing";
import { acceptInviteRoute } from "./http/routes/invites/accept-invite";
import { createInviteRoute } from "./http/routes/invites/create-invite";
import { getInviteRoute } from "./http/routes/invites/get-invite";
import { getInvitesRoute } from "./http/routes/invites/get-invites";
import { getPendingInvitesRoute } from "./http/routes/invites/get-pending-invites";
import { registerFromInviteRoute } from "./http/routes/invites/register-from-invite";
import { rejectInviteRoute } from "./http/routes/invites/reject-invite";
import { revokeInviteRoute } from "./http/routes/invites/revoke-invite";
import { getMembersRoute } from "./http/routes/members/get-members";
import { removeMemberRoute } from "./http/routes/members/remove-member";
import { updateMemberRoute } from "./http/routes/members/update-member";
import { createMenuCategoryRoute } from "./http/routes/menu/create-menu-category";
import { createMenuItemRoute } from "./http/routes/menu/create-menu-item";
import { deleteMenuItemRoute } from "./http/routes/menu/delete-menu-item";
import { getMenuCategoriesRoute } from "./http/routes/menu/get-menu-categories";
import { getMenuItemsRoute } from "./http/routes/menu/get-menu-items";
import { updateMenuItemRoute } from "./http/routes/menu/update-menu-item";
import { createRestaurantRoute } from "./http/routes/restaurants/create-restaurant";
import { deleteRestaurantRoute } from "./http/routes/restaurants/delete-restaurant";
import { getMembershipRoute } from "./http/routes/restaurants/get-membership";
import { getRestaurantRoute } from "./http/routes/restaurants/get-restaurant";
import { getRestaurantsRoute } from "./http/routes/restaurants/get-restaurants";
import { transferOwnershipRoute } from "./http/routes/restaurants/transfer-ownership";
import { updateRestaurantRoute } from "./http/routes/restaurants/update-restaurant";
import { createTableRoute } from "./http/routes/tables/create-table";
import { getTablesRoute } from "./http/routes/tables/get-tables";
import { createAccountRoute } from "./http/routes/user/create-account";
import { getProfileRoute } from "./http/routes/user/get-profile";

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.setErrorHandler(errorHandler);

app.register(fastifySwagger, {
	openapi: {
		info: {
			title: "ServiFast | API",
			description: "Full-stack SaaS app with multi-tenant & RBAC.",
			version: "1.0.0",
		},
		servers: [],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
				},
			},
		},
	},
	transform: jsonSchemaTransform,
});

app.register(ScalarApiReference, {
	routePrefix: "/docs",
	configuration: {
		title: "ServiFast | API",
		layout: "classic",
	},
});

app.register(fastifyJwt, {
	secret: env.JWT_SECRET ?? "",
});

app.register(fastifyCors);

app.register(fastifyMultipart, {
	attachFieldsToBody: false,
	limits: {
		fileSize: 5 * 1024 * 1024,
	},
});

app.register(fastifyStatic, {
	root: path.join(process.cwd(), "uploads"),
	prefix: "/uploads/",
});

app.register(createAccountRoute);
app.register(authenticateWithPasswordRoute);

app.register(requestPasswordRecoveryRoute);
app.register(resetPasswordRoute);

app.register(getProfileRoute);

app.register(createRestaurantRoute);
app.register(getMembershipRoute);
app.register(getRestaurantRoute);
app.register(getRestaurantsRoute);
app.register(updateRestaurantRoute);
app.register(deleteRestaurantRoute);
app.register(transferOwnershipRoute);

app.register(getMembersRoute);
app.register(updateMemberRoute);
app.register(removeMemberRoute);

app.register(createInviteRoute);
app.register(getInviteRoute);
app.register(getInvitesRoute);
app.register(registerFromInviteRoute);
app.register(acceptInviteRoute);
app.register(rejectInviteRoute);
app.register(revokeInviteRoute);
app.register(getPendingInvitesRoute);

app.register(createTableRoute);
app.register(getTablesRoute);

app.register(createMenuCategoryRoute);
app.register(getMenuCategoriesRoute);
app.register(createMenuItemRoute);
app.register(getMenuItemsRoute);
app.register(updateMenuItemRoute);
app.register(deleteMenuItemRoute);

app.register(getBillingRoute);
app.register(createExpenseRoute);

app.listen({ port: env.PORT, host: "0.0.0.0" }).then(() => {
	console.log(`🚀 | HTTP server running at http://localhost:${env.PORT}`);
	console.log(`📝 | Docs available at http://localhost:${env.PORT}/docs`);
});
