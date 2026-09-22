import { z } from "zod";

export const shiftSubject = z.tuple([
	z.union([z.literal("manage"), z.literal("get")]),
	z.literal("Shift"),
]);

export type ShiftSubject = z.infer<typeof shiftSubject>;
