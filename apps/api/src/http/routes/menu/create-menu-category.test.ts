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

describe("POST /restaurants/:slug/menu-categories", () => {
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

	it("creates a menu category when user is OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const categoryId = faker.string.uuid();

		prismaMock.menuCategory.findUnique.mockResolvedValue(null);
		prismaMock.menuCategory.create.mockResolvedValue({ id: categoryId });

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/menu-categories`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "Bebidas" },
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body)).toMatchObject({ categoryId });
	});

	it("creates a menu category when user is MANAGER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "MANAGER");
		const categoryId = faker.string.uuid();

		prismaMock.menuCategory.findUnique.mockResolvedValue(null);
		prismaMock.menuCategory.create.mockResolvedValue({ id: categoryId });

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/menu-categories`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "Sobremesas" },
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body)).toMatchObject({ categoryId });
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/menu-categories`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "Bebidas" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 UNAUTHORIZED when user is KITCHEN", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/menu-categories`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "Bebidas" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 400 CATEGORY_NAME_ALREADY_EXISTS when the name is taken", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);

		prismaMock.menuCategory.findUnique.mockResolvedValue({
			id: faker.string.uuid(),
			name: "Bebidas",
			restaurantId: restaurant.id,
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/menu-categories`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "Bebidas" },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "CATEGORY_NAME_ALREADY_EXISTS",
		});
	});

	it("returns 400 validation error when name is missing", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/menu-categories`,
			headers: { Authorization: `Bearer ${token}` },
			body: {},
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/restaurants/some-restaurant/menu-categories",
			body: { name: "Bebidas" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
