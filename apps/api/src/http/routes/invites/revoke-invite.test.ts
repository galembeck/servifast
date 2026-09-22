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

describe("DELETE /organizations/:slug/invites/:inviteId", () => {
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

	it("returns 204 when OWNER revokes an invite successfully", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);
		const inviteId = faker.string.uuid();

		prismaMock.invite.findUnique.mockResolvedValue({
			id: inviteId,
			email: faker.internet.email(),
			role: "WAITER" as const,
			organizationId: organization.id,
			authorId: faker.string.uuid(),
			createdAt: new Date(),
		});
		prismaMock.invite.delete.mockResolvedValue({} as never);

		const response = await app.inject({
			method: "DELETE",
			url: `/organizations/${organization.slug}/invites/${inviteId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(204);
	});

	it("returns 204 when MANAGER revokes an invite successfully", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "MANAGER");
		const token = signToken(app, userId);
		const inviteId = faker.string.uuid();

		prismaMock.invite.findUnique.mockResolvedValue({
			id: inviteId,
			email: faker.internet.email(),
			role: "WAITER" as const,
			organizationId: organization.id,
			authorId: faker.string.uuid(),
			createdAt: new Date(),
		});
		prismaMock.invite.delete.mockResolvedValue({} as never);

		const response = await app.inject({
			method: "DELETE",
			url: `/organizations/${organization.slug}/invites/${inviteId}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(204);
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "DELETE",
			url: `/organizations/${organization.slug}/invites/${faker.string.uuid()}`,
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
			method: "DELETE",
			url: `/organizations/${organization.slug}/invites/${faker.string.uuid()}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 400 NOT_FOUND when invite does not exist", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);

		prismaMock.invite.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "DELETE",
			url: `/organizations/${organization.slug}/invites/${faker.string.uuid()}`,
			headers: { Authorization: `Bearer ${token}` },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "NOT_FOUND",
		});
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "DELETE",
			url: `/organizations/some-org/invites/${faker.string.uuid()}`,
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
