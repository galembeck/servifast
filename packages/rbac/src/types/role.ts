import { z } from "zod";

export const roleSchema = z.union([
	z.literal("OWNER"),
	z.literal("MANAGER"),
	z.literal("WAITER"),
	z.literal("CASHIER"),
	z.literal("KITCHEN"),
	z.literal("BILLING"),
]);

export type Role = z.infer<typeof roleSchema>;
