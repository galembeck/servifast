import { faker } from "@faker-js/faker";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { buildApp } from "@/test/helpers/build-app";
import { mockMembership } from "@/test/helpers/membership";
import { signToken } from "@/test/helpers/sign-token";
import { prismaMock, resetPrismaMocks } from "../../../test/mocks/prisma.js";

vi.mock("@/lib/prisma", async () => {
	const { prismaMock } = await import("../../../test/mocks/prisma.js");
	return { prisma: prismaMock };
});

describe("GET /restaurants/:slug/membership", () => {
	let app: Awaited<ReturnType<typeof buildApp>>;

	beforeAll(async () => {
		app = await buildApp();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		resetPrismaMocks();
	});

	it("returns the user membership details", async () => {
		const userId = faker.string.uuid();
		const { restaurant, membership } = mockMembership(userId, "OWNER");

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/membership`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			membership: {
				id: membership.id,
				role: "OWNER",
				restaurantId: restaurant.id,
			},
		});
	});

	it("returns 401 UNAUTHORIZED when user is not a member", async () => {
		const userId = faker.string.uuid();

		prismaMock.member.findFirst.mockResolvedValue(null);

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: "/restaurants/nonexistent-restaurant/membership",
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});
});
