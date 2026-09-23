import { z } from "zod";

export const tableSubject = z.tuple([
	z.union([
		z.literal("manage"),
		z.literal("create"),
		z.literal("get"),
		z.literal("update"),
		z.literal("delete"),
	]),
	z.literal("Table"),
]);

export type TableSubject = z.infer<typeof tableSubject>;
