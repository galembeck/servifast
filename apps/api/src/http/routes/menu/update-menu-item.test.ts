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

const BOUNDARY = "----ServiFastTestBoundary";

function buildMultipartBody(fields: Record<string, string>) {
	const parts = Object.entries(fields).map(
		([name, value]) =>
			`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
	);

	return `${parts.join("")}--${BOUNDARY}--\r\n`;
}

describe("PUT /restaurants/:slug/menu-items/:itemId", () => {
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

	it("updates a menu item when user is OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const itemId = faker.string.uuid();
		const categoryId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.menuItem.findUnique.mockResolvedValue({
			id: itemId,
			restaurantId: restaurant.id,
			imageUrl: null,
		});
		prismaMock.menuCategory.findUnique.mockResolvedValue({
			id: categoryId,
			restaurantId: restaurant.id,
		});
		prismaMock.menuItem.update.mockResolvedValue({ id: itemId });

		const response = await app.inject({
			method: "PUT",
			url: `/restaurants/${restaurant.slug}/menu-items/${itemId}`,
			headers: {
				Authorization: `Bearer ${token}`,
				"content-type": `multipart/form-data; boundary=${BOUNDARY}`,
			},
			payload: buildMultipartBody({
				name: "Refrigerante Zero",
				description: "Lata 350ml sem açúcar",
				price: "6.50",
				categoryId,
				isAvailable: "true",
			}),
		});

		expect(response.statusCode).toBe(204);
		expect(prismaMock.menuItem.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: itemId },
				data: expect.objectContaining({
					name: "Refrigerante Zero",
					priceInCents: 650,
					isAvailable: true,
				}),
			})
		);
	});

	it("marks a menu item as unavailable when isAvailable is not sent as true", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "MANAGER");
		const itemId = faker.string.uuid();
		const categoryId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.menuItem.findUnique.mockResolvedValue({
			id: itemId,
			restaurantId: restaurant.id,
			imageUrl: null,
		});
		prismaMock.menuCategory.findUnique.mockResolvedValue({
			id: categoryId,
			restaurantId: restaurant.id,
		});
		prismaMock.menuItem.update.mockResolvedValue({ id: itemId });

		const response = await app.inject({
			method: "PUT",
			url: `/restaurants/${restaurant.slug}/menu-items/${itemId}`,
			headers: {
				Authorization: `Bearer ${token}`,
				"content-type": `multipart/form-data; boundary=${BOUNDARY}`,
			},
			payload: buildMultipartBody({
				name: "Refrigerante Zero",
				price: "6.50",
				categoryId,
			}),
		});

		expect(response.statusCode).toBe(204);
		expect(prismaMock.menuItem.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ isAvailable: false }),
			})
		);
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "PUT",
			url: `/restaurants/${restaurant.slug}/menu-items/${itemId}`,
			headers: {
				Authorization: `Bearer ${token}`,
				"content-type": `multipart/form-data; boundary=${BOUNDARY}`,
			},
			payload: buildMultipartBody({
				name: "Refrigerante",
				price: "5.90",
				categoryId: faker.string.uuid(),
			}),
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
			method: "PUT",
			url: `/restaurants/${restaurant.slug}/menu-items/${itemId}`,
			headers: {
				Authorization: `Bearer ${token}`,
				"content-type": `multipart/form-data; boundary=${BOUNDARY}`,
			},
			payload: buildMultipartBody({
				name: "Refrigerante",
				price: "5.90",
				categoryId: faker.string.uuid(),
			}),
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "ITEM_NOT_FOUND",
		});
	});

	it("returns 400 CATEGORY_NOT_FOUND when the category does not exist", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.menuItem.findUnique.mockResolvedValue({
			id: itemId,
			restaurantId: restaurant.id,
			imageUrl: null,
		});
		prismaMock.menuCategory.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "PUT",
			url: `/restaurants/${restaurant.slug}/menu-items/${itemId}`,
			headers: {
				Authorization: `Bearer ${token}`,
				"content-type": `multipart/form-data; boundary=${BOUNDARY}`,
			},
			payload: buildMultipartBody({
				name: "Refrigerante",
				price: "5.90",
				categoryId: faker.string.uuid(),
			}),
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "CATEGORY_NOT_FOUND",
		});
	});

	it("returns 400 validation error when name is missing", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.menuItem.findUnique.mockResolvedValue({
			id: itemId,
			restaurantId: restaurant.id,
			imageUrl: null,
		});

		const response = await app.inject({
			method: "PUT",
			url: `/restaurants/${restaurant.slug}/menu-items/${itemId}`,
			headers: {
				Authorization: `Bearer ${token}`,
				"content-type": `multipart/form-data; boundary=${BOUNDARY}`,
			},
			payload: buildMultipartBody({
				price: "5.90",
				categoryId: faker.string.uuid(),
			}),
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "PUT",
			url: `/restaurants/some-restaurant/menu-items/${faker.string.uuid()}`,
			headers: {
				"content-type": `multipart/form-data; boundary=${BOUNDARY}`,
			},
			payload: buildMultipartBody({
				name: "Refrigerante",
				price: "5.90",
				categoryId: faker.string.uuid(),
			}),
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
