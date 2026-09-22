import type { AuthException } from "./auth";
import type { BusinessException } from "./business/business";
import type { InviteException } from "./invite";
import type { RestaurantException } from "./restaurant";
import type { UserException } from "./user";

export type AppException =
	| AuthException
	| RestaurantException
	| UserException
	| BusinessException
	| InviteException;
