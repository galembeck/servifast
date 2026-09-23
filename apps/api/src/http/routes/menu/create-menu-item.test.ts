import { unlink } from "node:fs/promises";
import path from "node:path";
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
const SAVED_IMAGE_PATH_PATTERN = /^\/uploads\/menu-items\/.+\.png$/;

function buildMultipartBody(fields: Record<string, string>) {
	const parts = Object.entries(fields).map(
		([name, value]) =>
			`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
	);

	return `${parts.join("")}--${BOUNDARY}--\r\n`;
}

function buildMultipartBodyWithImage(fields: Record<string, string>) {
	const parts = Object.entries(fields).map(
		([name, value]) =>
			`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
	);

	const imagePart =
		`--${BOUNDARY}\r\nContent-Disposition: form-data; name="image"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n` +
		"fake-image-bytes\r\n";

	return `${parts.join("")}${imagePart}--${BOUNDARY}--\r\n`;
}

describe("POST /restaurants/:slug/menu-items", () => {
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

	it("creates a menu item when user is OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const categoryId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.menuCategory.findUnique.mockResolvedValue({
			id: categoryId,
			restaurantId: restaurant.id,
		});
		prismaMock.menuItem.create.mockResolvedValue({ id: itemId });

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/menu-items`,
			headers: {
				Authorization: `Bearer ${token}`,
				"content-type": `multipart/form-data; boundary=${BOUNDARY}`,
			},
			payload: buildMultipartBody({
				name: "Refrigerante",
				description: "Lata 350ml",
				price: "5.90",
				categoryId,
			}),
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body)).toMatchObject({ itemId });
		expect(prismaMock.menuItem.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ priceInCents: 590, imageUrl: null }),
			})
		);
	});

	it("creates a menu item with an image upload without hanging", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const categoryId = faker.string.uuid();
		const itemId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.menuCategory.findUnique.mockResolvedValue({
			id: categoryId,
			restaurantId: restaurant.id,
		});
		prismaMock.menuItem.create.mockResolvedValue({ id: itemId });

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/menu-items`,
			headers: {
				Authorization: `Bearer ${token}`,
				"content-type": `multipart/form-data; boundary=${BOUNDARY}`,
			},
			payload: buildMultipartBodyWithImage({
				name: "Refrigerante",
				price: "5.90",
				categoryId,
			}),
		});

		expect(response.statusCode).toBe(201);

		const imageUrl = prismaMock.menuItem.create.mock.calls[0]?.[0]?.data
			?.imageUrl as string;
		expect(imageUrl).toMatch(SAVED_IMAGE_PATH_PATTERN);

		await unlink(
			path.join(process.cwd(), "uploads", "menu-items", path.basename(imageUrl))
		);
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/menu-items`,
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

	it("returns 400 CATEGORY_NOT_FOUND when the category does not exist", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);

		prismaMock.menuCategory.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/menu-items`,
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
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/menu-items`,
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
			method: "POST",
			url: "/restaurants/some-restaurant/menu-items",
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
