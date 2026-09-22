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

describe("POST /restaurants/:slug/projects", () => {
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

	it("creates a project when user is OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const projectId = faker.string.uuid();

		prismaMock.project.create.mockResolvedValue({ id: projectId });

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/projects`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "New Project", description: "A test project" },
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body)).toMatchObject({ projectId });
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/projects`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "New Project", description: "A test project" },
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
			method: "POST",
			url: `/restaurants/${restaurant.slug}/projects`,
			headers: { Authorization: `Bearer ${token}` },
			body: { name: "New Project", description: "A test project" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/restaurants/some-org/projects",
			body: { name: "New Project", description: "A test project" },
		});

		expect(response.statusCode).toBe(401);
	});
});
