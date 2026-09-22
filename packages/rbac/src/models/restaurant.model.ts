import { z } from "zod";

export const restaurantSchema = z.object({
	__typename: z.literal("Restaurant").default("Restaurant"),
	id: z.string(),
	ownerId: z.string(),
});

export type Restaurant = z.infer<typeof restaurantSchema>;
