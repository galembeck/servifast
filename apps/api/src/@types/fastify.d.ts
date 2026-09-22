import "fastify";

import type { Member, Restaurant } from "@/generated/prisma/client.js";

declare module "fastify" {
	export interface FastifyRequest {
		getCurrentUserId(): Promise<string>;
		getUserMembership(
			slug: string
		): Promise<{ restaurant: Restaurant; membership: Member }>;
	}
}
