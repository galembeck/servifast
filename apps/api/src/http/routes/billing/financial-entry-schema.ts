import { z } from "zod";

export const financialEntrySchema = z.object({
	id: z.uuid(),
	category: z.string(),
	amountInCents: z.number(),
	type: z.enum(["EXPENSE", "INCOME"]),
	status: z.enum(["LEGACY", "PENDING", "PAID", "RECEIVED"]),
	settledOn: z.string().nullable(),
	settledAt: z.string().nullable(),
});

// DATE is a calendar day, never a local-midnight instant. Serialize in UTC so
// browsers in any time zone receive the same YYYY-MM-DD selected by the user.
export function serializeFinancialEntry<
	T extends { settledOn: Date | null; settledAt: Date | null },
>(entry: T) {
	return {
		...entry,
		settledOn: entry.settledOn?.toISOString().slice(0, 10) ?? null,
		settledAt: entry.settledAt?.toISOString() ?? null,
	};
}
