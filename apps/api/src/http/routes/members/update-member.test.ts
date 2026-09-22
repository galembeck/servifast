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

describe("PUT /organizations/:slug/members/:memberId", () => {
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

	it("updates the member role when user is OWNER", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "OWNER");
		const memberId = faker.string.uuid();

		prismaMock.member.findUnique.mockResolvedValue({
			id: memberId,
			organizationId: organization.id,
			userId: faker.string.uuid(),
			role: "WAITER",
		});
		prismaMock.member.update.mockResolvedValue({ id: memberId });

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "PUT",
			url: `/organizations/${organization.slug}/members/${memberId}`,
			headers: { Authorization: `Bearer ${token}` },
			body: { role: "BILLING" },
		});

		expect(response.statusCode).toBe(204);
	});

	it("updates the member role when user is MANAGER", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "MANAGER");
		const memberId = faker.string.uuid();

		prismaMock.member.findUnique.mockResolvedValue({
			id: memberId,
			organizationId: organization.id,
			userId: faker.string.uuid(),
			role: "WAITER",
		});
		prismaMock.member.update.mockResolvedValue({ id: memberId });

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "PUT",
			url: `/organizations/${organization.slug}/members/${memberId}`,
			headers: { Authorization: `Bearer ${token}` },
			body: { role: "CASHIER" },
		});

		expect(response.statusCode).toBe(204);
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "WAITER");
		const memberId = faker.string.uuid();

		prismaMock.member.findUnique.mockResolvedValue({
			id: memberId,
			organizationId: organization.id,
			userId: faker.string.uuid(),
			role: "BILLING",
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "PUT",
			url: `/organizations/${organization.slug}/members/${memberId}`,
			headers: { Authorization: `Bearer ${token}` },
			body: { role: "WAITER" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 UNAUTHORIZED when user is BILLING", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "BILLING");
		const memberId = faker.string.uuid();

		prismaMock.member.findUnique.mockResolvedValue({
			id: memberId,
			organizationId: organization.id,
			userId: faker.string.uuid(),
			role: "WAITER",
		});

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "PUT",
			url: `/organizations/${organization.slug}/members/${memberId}`,
			headers: { Authorization: `Bearer ${token}` },
			body: { role: "BILLING" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 400 NOT_FOUND when member does not exist in the organization", async () => {
		const userId = faker.string.uuid();
		const { organization } = mockMembership(userId, "OWNER");

		prismaMock.member.findUnique.mockResolvedValue(null);

		const token = signToken(app, userId);

		const response = await app.inject({
			method: "PUT",
			url: `/organizations/${organization.slug}/members/${faker.string.uuid()}`,
			headers: { Authorization: `Bearer ${token}` },
			body: { role: "WAITER" },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({ message: "NOT_FOUND" });
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "PUT",
			url: `/organizations/some-org/members/${faker.string.uuid()}`,
			body: { role: "WAITER" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
