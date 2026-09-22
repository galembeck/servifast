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

describe("PUT /restaurants/:slug", () => {
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

	it("updates the restaurant when user is OWNER and owner", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");

		prismaMock.restaurant.findFirst.mockResolvedValue(null);
		prismaMock.restaurant.update.mockResolvedValue({ id: restaurant.id });

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "PUT",
			url: `/restaurants/${restaurant.slug}`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "Updated Name" },
		});

		expect(response.statusCode).toBe(204);
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "PUT",
			url: `/restaurants/${restaurant.slug}`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "Updated Name" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 UNAUTHORIZED when OWNER does not own the restaurant", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");

		// Override the ownerId to someone else
		prismaMock.member.findFirst.mockResolvedValue({
			id: faker.string.uuid(),
			role: "OWNER",
			restaurantId: restaurant.id,
			userId,
			restaurant: { ...restaurant, ownerId: faker.string.uuid() },
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "PUT",
			url: `/restaurants/${restaurant.slug}`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "Updated Name" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 400 DOMAIN_ALREADY_IN_USE when domain conflicts", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");

		// Override restaurant to have a domain set
		const orgWithDomain = { ...restaurant, domain: "taken.com" };
		prismaMock.member.findFirst.mockResolvedValue({
			id: faker.string.uuid(),
			role: "OWNER",
			restaurantId: restaurant.id,
			userId,
			restaurant: orgWithDomain,
		});

		prismaMock.restaurant.findFirst.mockResolvedValue({
			id: faker.string.uuid(),
			domain: "taken.com",
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "PUT",
			url: `/restaurants/${restaurant.slug}`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "Updated Name" },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "DOMAIN_ALREADY_IN_USE",
		});
	});
});
