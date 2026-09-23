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

describe("GET /restaurants/:slug/billing", () => {
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

	it("returns billing info for OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);

		prismaMock.member.count.mockResolvedValueOnce(3);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/billing`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			billing: {
				seats: { amount: 3, unit: 10, price: 30 },
				total: 30,
			},
		});
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/billing`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns billing info for BILLING role", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "BILLING");
		const token = signToken(app, userId);

		prismaMock.member.count.mockResolvedValueOnce(1);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/billing`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
	});

	it("returns billing info for MANAGER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "MANAGER");
		const token = signToken(app, userId);

		prismaMock.member.count.mockResolvedValueOnce(2);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/billing`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
	});

	it("returns billing info for CASHIER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "CASHIER");
		const token = signToken(app, userId);

		prismaMock.member.count.mockResolvedValueOnce(2);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/billing`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/restaurants/some-org/billing",
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
