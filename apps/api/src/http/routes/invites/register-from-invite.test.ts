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

const VALID_CPF = "529.982.247-25";

describe("POST /invites/:inviteId/register", () => {
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

	it("creates an account, accepts the invite, and returns an access token", async () => {
		const inviteId = faker.string.uuid();
		const invite = {
			id: inviteId,
			email: faker.internet.email(),
			role: "WAITER" as const,
			restaurantId: faker.string.uuid(),
		};

		prismaMock.invite.findUnique.mockResolvedValue(invite);
		prismaMock.user.findUnique.mockResolvedValue(null);
		prismaMock.$transaction.mockResolvedValue([]);

		const response = await app.inject({
			method: "POST",
			url: `/invites/${inviteId}/register`,
			body: {
				name: "Jane Doe",
				cpf: VALID_CPF,
				password: "secret123",
			},
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body)).toHaveProperty("accessToken");
		expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
	});

	it("returns 400 NOT_FOUND when invite does not exist", async () => {
		prismaMock.invite.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "POST",
			url: `/invites/${faker.string.uuid()}/register`,
			body: {
				name: "Jane Doe",
				cpf: VALID_CPF,
				password: "secret123",
			},
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "NOT_FOUND",
		});
	});

	it("returns 400 EMAIL_ALREADY_REGISTERED when a user already exists with the invite's e-mail", async () => {
		const inviteId = faker.string.uuid();

		prismaMock.invite.findUnique.mockResolvedValue({
			id: inviteId,
			email: faker.internet.email(),
			role: "WAITER" as const,
			restaurantId: faker.string.uuid(),
		});
		prismaMock.user.findUnique.mockResolvedValue({ id: faker.string.uuid() });

		const response = await app.inject({
			method: "POST",
			url: `/invites/${inviteId}/register`,
			body: {
				name: "Jane Doe",
				cpf: VALID_CPF,
				password: "secret123",
			},
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "EMAIL_ALREADY_REGISTERED",
		});
	});

	it("returns 400 INVALID_CPF when the CPF checksum is invalid", async () => {
		const inviteId = faker.string.uuid();

		prismaMock.invite.findUnique.mockResolvedValue({
			id: inviteId,
			email: faker.internet.email(),
			role: "WAITER" as const,
			restaurantId: faker.string.uuid(),
		});
		prismaMock.user.findUnique.mockResolvedValueOnce(null);

		const response = await app.inject({
			method: "POST",
			url: `/invites/${inviteId}/register`,
			body: {
				name: "Jane Doe",
				cpf: "529.982.247-26",
				password: "secret123",
			},
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_CPF",
		});
	});

	it("returns 400 CPF_ALREADY_REGISTERED when a user already exists with the same CPF", async () => {
		const inviteId = faker.string.uuid();

		prismaMock.invite.findUnique.mockResolvedValue({
			id: inviteId,
			email: faker.internet.email(),
			role: "WAITER" as const,
			restaurantId: faker.string.uuid(),
		});
		prismaMock.user.findUnique
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: faker.string.uuid() });

		const response = await app.inject({
			method: "POST",
			url: `/invites/${inviteId}/register`,
			body: {
				name: "Jane Doe",
				cpf: VALID_CPF,
				password: "secret123",
			},
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "CPF_ALREADY_REGISTERED",
		});
	});

	it("returns 400 validation error when password is too short", async () => {
		const response = await app.inject({
			method: "POST",
			url: `/invites/${faker.string.uuid()}/register`,
			body: {
				name: "Jane Doe",
				cpf: VALID_CPF,
				password: "123",
			},
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});
});
