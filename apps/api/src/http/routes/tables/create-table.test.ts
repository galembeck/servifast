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

describe("POST /restaurants/:slug/tables", () => {
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

	it("creates a table when user is OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const tableId = faker.string.uuid();

		prismaMock.table.findUnique.mockResolvedValue(null);
		prismaMock.table.create.mockResolvedValue({ id: tableId });

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables`,
			headers: { Authorization: `Bearer ${token}` },
			body: {
				number: 1,
				positionReference: "Near the window",
				seatsCount: 4,
				observations: "Wheelchair accessible",
			},
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body)).toMatchObject({ tableId });
	});

	it("creates a table when user is MANAGER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "MANAGER");
		const tableId = faker.string.uuid();

		prismaMock.table.findUnique.mockResolvedValue(null);
		prismaMock.table.create.mockResolvedValue({ id: tableId });

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables`,
			headers: { Authorization: `Bearer ${token}` },
			body: { number: 2, seatsCount: 2 },
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body)).toMatchObject({ tableId });
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables`,
			headers: { Authorization: `Bearer ${token}` },
			body: { number: 1, seatsCount: 4 },
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
			url: `/restaurants/${restaurant.slug}/tables`,
			headers: { Authorization: `Bearer ${token}` },
			body: { number: 1, seatsCount: 4 },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 400 TABLE_NUMBER_ALREADY_EXISTS when the number is taken", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);

		prismaMock.table.findUnique.mockResolvedValue({
			id: faker.string.uuid(),
			number: 1,
			restaurantId: restaurant.id,
		});

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables`,
			headers: { Authorization: `Bearer ${token}` },
			body: { number: 1, seatsCount: 4 },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TABLE_NUMBER_ALREADY_EXISTS",
		});
	});

	it("returns 400 validation error when seatsCount is missing", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tables`,
			headers: { Authorization: `Bearer ${token}` },
			body: { number: 1 },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/restaurants/some-restaurant/tables",
			body: { number: 1, seatsCount: 4 },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
