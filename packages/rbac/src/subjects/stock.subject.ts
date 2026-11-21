import { z } from "zod";

export const stockSubject = z.tuple([
	z.union([z.literal("manage"), z.literal("get")]),
	z.literal("Stock"),
]);

export type StockSubject = z.infer<typeof stockSubject>;
