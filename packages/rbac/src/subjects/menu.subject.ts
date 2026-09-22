import { z } from "zod";

export const menuSubject = z.tuple([
	z.union([
		z.literal("manage"),
		z.literal("get"),
		z.literal("create"),
		z.literal("update"),
		z.literal("delete"),
	]),
	z.literal("Menu"),
]);

export type MenuSubject = z.infer<typeof menuSubject>;
