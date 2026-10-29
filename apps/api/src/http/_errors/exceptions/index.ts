import type { AuthException } from "./auth";
import type { BusinessException } from "./business/business";
import type { InviteException } from "./invite";
import type { KdsException } from "./kds";
import type { MenuException } from "./menu";
import type { RestaurantException } from "./restaurant";
import type { TabException } from "./tab";
import type { TableException } from "./table";
import type { UserException } from "./user";

export type AppException =
	| AuthException
	| RestaurantException
	| UserException
	| BusinessException
	| InviteException
	| TableException
	| TabException
	| MenuException
	| KdsException;
