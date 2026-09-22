import { faker } from "@faker-js/faker";
import type { Role } from "@repo/rbac/src/types/role";
import { prismaMock } from "../mocks/prisma";

export function mockMembership(userId: string, role: Role = "OWNER") {
	const orgId = faker.string.uuid();
	const organization = {
		id: orgId,
		name: "Test Organization",
		slug: "test-organization",
		domain: null,
		shouldAttachUsersByDomain: false,
		avatarUrl: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		ownerId: userId,
	};

	const membership = {
		id: faker.string.uuid(),
		role,
		organizationId: orgId,
		userId,
	};

	prismaMock.member.findFirst.mockResolvedValue({
		...membership,
		organization,
	});

	return { organization, membership };
}
