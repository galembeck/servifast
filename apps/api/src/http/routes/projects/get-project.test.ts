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

function makeProject(restaurantId: string, ownerId: string) {
	return {
		id: faker.string.uuid(),
		name: "Test Project",
		description: "A test project",
		slug: "test-project",
		avatarUrl: null,
		restaurantId,
		ownerId,
		owner: {
			id: ownerId,
			name: faker.person.fullName(),
			avatarUrl: null,
		},
	};
}

describe("GET /restaurants/:orgSlug/projects/:projectSlug", () => {
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

	it("returns the project for an OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const project = makeProject(restaurant.id, faker.string.uuid());

		prismaMock.project.findUnique.mockResolvedValue(project);

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/projects/${project.slug}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			project: {
				id: project.id,
				name: project.name,
				slug: project.slug,
				restaurantId: restaurant.id,
			},
		});
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/projects/any-project`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 UNAUTHORIZED when user is BILLING", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "BILLING");

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/projects/any-project`,
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
			method: "GET",
			url: `/restaurants/${restaurant.slug}/projects/nonexistent-project`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "NOT_FOUND",
		});
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/restaurants/some-org/projects/some-project",
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
