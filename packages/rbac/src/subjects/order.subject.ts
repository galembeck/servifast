import { z } from "zod";

export const orderSubject = z.tuple([
	z.union([
		z.literal("manage"),
		z.literal("get"),
		z.literal("create"),
		z.literal("update"),
	]),
	z.literal("Order"),
]);

export type OrderSubject = z.infer<typeof orderSubject>;
