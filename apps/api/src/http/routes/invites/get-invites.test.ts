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

describe("GET /organizations/:slug/invites", () => {
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

	it("returns invites list when user is OWNER", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);

		const invites = [
			{
				id: faker.string.uuid(),
				email: faker.internet.email(),
				role: "WAITER" as const,
				createdAt: new Date(),
				author: {
					id: faker.string.uuid(),
					name: faker.person.fullName(),
					email: faker.internet.email(),
				},
			},
			{
				id: faker.string.uuid(),
				email: faker.internet.email(),
				role: "BILLING" as const,
				createdAt: new Date(),
				author: null,
			},
		];

		prismaMock.invite.findMany.mockResolvedValue(invites);

		const response = await app.inject({
			method: "GET",
			url: `/organizations/${organization.slug}/invites`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			invites: [
				{ id: invites[0]?.id, email: invites[0]?.email, role: "WAITER" },
				{ id: invites[1]?.id, email: invites[1]?.email, role: "BILLING" },
			],
		});
	});

	it("returns invites list when user is MANAGER", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "MANAGER");
		const token = signToken(app, userId);

		prismaMock.invite.findMany.mockResolvedValue([]);

		const response = await app.inject({
			method: "GET",
			url: `/organizations/${organization.slug}/invites`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(200);
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/organizations/${organization.slug}/invites`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 UNAUTHORIZED when user is BILLING", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "BILLING");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "GET",
			url: `/organizations/${organization.slug}/invites`,
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
			url: "/organizations/some-org/invites",
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
