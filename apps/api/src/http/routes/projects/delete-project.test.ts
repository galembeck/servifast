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

describe("DELETE /restaurants/:slug/projects/:projectId", () => {
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

	it("deletes the project when user is OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const projectId = faker.string.uuid();

		prismaMock.project.findUnique.mockResolvedValue({
			id: projectId,
			restaurantId: restaurant.id,
			ownerId: faker.string.uuid(),
		});
		prismaMock.project.delete.mockResolvedValue({ id: projectId });

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}/projects/${projectId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(204);
	});

	it("returns 401 UNAUTHORIZED when WAITER owns the project", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const projectId = faker.string.uuid();

		prismaMock.project.findUnique.mockResolvedValue({
			id: projectId,
			restaurantId: restaurant.id,
			ownerId: userId,
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}/projects/${projectId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 UNAUTHORIZED when WAITER does not own the project", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const projectId = faker.string.uuid();

		prismaMock.project.findUnique.mockResolvedValue({
			id: projectId,
			restaurantId: restaurant.id,
			ownerId: faker.string.uuid(),
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}/projects/${projectId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 400 NOT_FOUND when project does not exist in the restaurant", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");

		prismaMock.project.findUnique.mockResolvedValue(null);

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "DELETE",
			url: `/restaurants/${restaurant.slug}/projects/${faker.string.uuid()}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "NOT_FOUND",
		});
	});
});
