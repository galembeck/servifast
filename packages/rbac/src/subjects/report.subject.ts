import { z } from "zod";

export const reportSubject = z.tuple([
	z.union([z.literal("manage"), z.literal("get")]),
	z.literal("Report"),
]);

export type ReportSubject = z.infer<typeof reportSubject>;
