import type { AbilityBuilder } from "@casl/ability";
import type { AppAbility } from ".";
import type { User } from "./models/user.model";
import type { Role } from "./types/role";

type PermissionsByRole = (
	user: User,
	builder: AbilityBuilder<AppAbility>
) => void;

export const permissions: Record<Role, PermissionsByRole> = {
	OWNER(user, { can, cannot }) {
		can("manage", "all");

		cannot(["transfer_ownership", "update"], "Restaurant");
		can(["transfer_ownership", "update"], "Restaurant", {
			ownerId: { $eq: user.id },
		});
	},

	MANAGER(_, { can }) {
		can("manage", "Order");
		can("manage", "Table");
		can("manage", "Menu");
		can("manage", "Shift");

		can(["create", "get", "delete"], "Invite");

		can(["get", "update"], "User");

		can(["get", "create"], "Billing");
	},

	WAITER(_, { can }) {
		can(["create", "get", "update"], "Order");
		can(["get", "update"], "Table");
		can("get", "Menu");
	},

	CASHIER(_, { can }) {
		can(["get", "update"], "Order");
		can("manage", "Shift");
		can(["get", "create"], "Billing");
	},

	KITCHEN(_, { can }) {
		can(["get", "update"], "Order");
		can("get", "Menu");
	},

	BILLING(_, { can }) {
		can("manage", "Billing");
		can("get", "Order");
	},
};
