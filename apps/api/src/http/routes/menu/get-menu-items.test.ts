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

describe("GET /restaurants/:slug/menu-items", () => {
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

	it("returns menu items list for OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);

		const categoryId = faker.string.uuid();

		prismaMock.menuItem.findMany.mockResolvedValue([
			{
				id: faker.string.uuid(),
				name: "Refrigerante",
				description: null,
				priceInCents: 500,
				imageUrl: null,
				categoryId,
				isAvailable: true,
			},
		]);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/menu-items`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			items: [{ name: "Refrigerante", priceInCents: 500 }],
		});
	});

	it("filters by categoryId when provided", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);
		const categoryId = faker.string.uuid();

		prismaMock.menuItem.findMany.mockResolvedValue([]);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/menu-items?categoryId=${categoryId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		expect(prismaMock.menuItem.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ categoryId }),
			})
		);
	});

	it("returns 401 UNAUTHORIZED when user is CASHIER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "CASHIER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/menu-items`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/restaurants/some-restaurant/menu-items",
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
