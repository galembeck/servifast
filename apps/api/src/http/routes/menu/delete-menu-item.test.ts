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

describe("DELETE /restaurants/:slug/menu-items/:itemId", () => {
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

	it("deletes the menu item when user is OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.menuItem.findUnique.mockResolvedValue({
			id: itemId,
			restaurantId: restaurant.id,
			imageUrl: null,
		});
		prismaMock.menuItem.delete.mockResolvedValue({ id: itemId });

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}/menu-items/${itemId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(204);
		expect(prismaMock.menuItem.delete).toHaveBeenCalledWith({
			where: { id: itemId },
		});
	});

	it("deletes the menu item when user is MANAGER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "MANAGER");
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.menuItem.findUnique.mockResolvedValue({
			id: itemId,
			restaurantId: restaurant.id,
			imageUrl: null,
		});
		prismaMock.menuItem.delete.mockResolvedValue({ id: itemId });

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}/menu-items/${itemId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(204);
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}/menu-items/${itemId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 UNAUTHORIZED when user is KITCHEN", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}/menu-items/${itemId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 400 ITEM_NOT_FOUND when the item does not exist", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.menuItem.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}/menu-items/${itemId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "ITEM_NOT_FOUND",
		});
	});

	it("returns 400 validation error for an invalid itemId", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}/menu-items/not-a-uuid`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/some-restaurant/menu-items/${faker.string.uuid()}`,
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
