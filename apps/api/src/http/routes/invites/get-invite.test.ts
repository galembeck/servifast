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
import { prismaMock, resetPrismaMocks } from "../../../test/mocks/prisma.js";

vi.mock("@/lib/prisma", async () => {
	const { prismaMock } = await import("../../../test/mocks/prisma.js");
	return { prisma: prismaMock };
});

describe("GET /invites/:inviteId", () => {
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

	it("returns invite details when invite exists and email has no account", async () => {
		const inviteId = faker.string.uuid();
		const invite = {
			id: inviteId,
			email: faker.internet.email(),
			role: "WAITER" as const,
			createdAt: new Date(),
			author: {
				id: faker.string.uuid(),
				name: faker.person.fullName(),
				avatarUrl: faker.internet.url(),
			},
			restaurant: {
				name: faker.company.name(),
				slug: faker.lorem.slug(),
			},
		};

		prismaMock.invite.findUnique.mockResolvedValue(invite);
		prismaMock.user.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "GET",
			url: `/invites/${inviteId}`,
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			invite: {
				id: inviteId,
				email: invite.email,
				role: invite.role,
				restaurant: {
					name: invite.restaurant.name,
					slug: invite.restaurant.slug,
				},
				author: {
					id: invite.author.id,
					name: invite.author.name,
					avatarUrl: invite.author.avatarUrl,
				},
				emailHasAccount: false,
			},
		});
	});

	it("returns emailHasAccount true when a user already exists with the invite's e-mail", async () => {
		const inviteId = faker.string.uuid();
		const invite = {
			id: inviteId,
			email: faker.internet.email(),
			role: "WAITER" as const,
			createdAt: new Date(),
			author: null,
			restaurant: {
				name: faker.company.name(),
				slug: faker.lorem.slug(),
			},
		};

		prismaMock.invite.findUnique.mockResolvedValue(invite);
		prismaMock.user.findUnique.mockResolvedValue({ id: faker.string.uuid() });

		const response = await app.inject({
			method: "GET",
			url: `/invites/${inviteId}`,
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			invite: { emailHasAccount: true },
		});
	});

	it("returns invite details with null author when invite has no author", async () => {
		const inviteId = faker.string.uuid();
		const invite = {
			id: inviteId,
			email: faker.internet.email(),
			role: "OWNER" as const,
			createdAt: new Date(),
			author: null,
			restaurant: {
				name: faker.company.name(),
				slug: faker.lorem.slug(),
			},
		};

		prismaMock.invite.findUnique.mockResolvedValue(invite);
		prismaMock.user.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "GET",
			url: `/invites/${inviteId}`,
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			invite: {
				id: inviteId,
				author: null,
			},
		});
	});

	it("returns 400 NOT_FOUND when invite does not exist", async () => {
		prismaMock.invite.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "GET",
			url: `/invites/${faker.string.uuid()}`,
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "NOT_FOUND",
		});
	});

	it("returns 400 validation error when inviteId is not a valid UUID", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/invites/not-a-valid-uuid",
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});
});
