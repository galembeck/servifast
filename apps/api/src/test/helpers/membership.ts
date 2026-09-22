import { faker } from "@faker-js/faker";
import type { Role } from "@repo/rbac/src/types/role";
import { prismaMock } from "../mocks/prisma";

export function mockMembership(userId: string, role: Role = "OWNER") {
	const restaurantId = faker.string.uuid();
	const restaurant = {
		id: restaurantId,
		name: "Test Restaurant",
		slug: "test-restaurant",
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
		restaurantId,
		userId,
	};

	prismaMock.member.findFirst.mockResolvedValue({
		...membership,
		restaurant,
	});

	return { restaurant, membership };
}
