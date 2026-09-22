import "fastify";

import type { Member, Organization } from "@/generated/prisma/client.js";

declare module "fastify" {
	export interface FastifyRequest {
		getCurrentUserId(): Promise<string>;
		getUserMembership(
			slug: string
		): Promise<{ organization: Organization; membership: Member }>;
	}
}
