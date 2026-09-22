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

describe("DELETE /restaurants/:slug", () => {
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

	it("deletes the restaurant when user is OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");

		prismaMock.restaurant.delete.mockResolvedValue({ id: restaurant.id });

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(204);
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});
});
