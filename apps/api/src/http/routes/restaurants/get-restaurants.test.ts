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
import { signToken } from "@/test/helpers/sign-token";
import { prismaMock, resetPrismaMocks } from "../../../test/mocks/prisma.js";

vi.mock("@/lib/prisma", async () => {
	const { prismaMock } = await import("../../../test/mocks/prisma.js");
	return { prisma: prismaMock };
});

describe("GET /restaurants", () => {
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

	it("returns restaurants with user role", async () => {
		const userId = faker.string.uuid();

		prismaMock.restaurant.findMany.mockResolvedValue([
			{
				id: faker.string.uuid(),
				name: "Org One",
				slug: "org-one",
				avatarUrl: null,
				members: [{ role: "OWNER" }],
			},
			{
				id: faker.string.uuid(),
				name: "Org Two",
				slug: "org-two",
				avatarUrl: null,
				members: [{ role: "WAITER" }],
			},
		]);

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: "/restaurants",
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body);
		expect(body.restaurants).toHaveLength(2);
		expect(body.restaurants[0]).toMatchObject({
			slug: "org-one",
			role: "OWNER",
		});
		expect(body.restaurants[1]).toMatchObject({
			slug: "org-two",
			role: "WAITER",
		});
	});

	it("returns empty list when user has no restaurants", async () => {
		const userId = faker.string.uuid();

		prismaMock.restaurant.findMany.mockResolvedValue([]);

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: "/restaurants",
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({ restaurants: [] });
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/restaurants",
		});

		expect(response.statusCode).toBe(401);
	});
});
