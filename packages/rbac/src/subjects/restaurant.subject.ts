import { z } from "zod";
import { restaurantSchema } from "../models/restaurant.model";

export const restaurantSubject = z.tuple([
	z.union([
		z.literal("manage"),
		z.literal("create"),
		z.literal("update"),
		z.literal("delete"),
		z.literal("transfer_ownership"),
	]),
	z.union([z.literal("Restaurant"), restaurantSchema]),
]);

export type RestaurantSubject = z.infer<typeof restaurantSubject>;
