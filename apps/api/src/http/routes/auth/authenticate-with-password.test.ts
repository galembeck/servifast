import { faker } from "@faker-js/faker";
import { hash } from "bcryptjs";
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

describe("POST /sessions/password", () => {
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

	it("returns access token with a valid e-mail and password", async () => {
		const password = "secret123";
		const passwordHash = await hash(password, 6);
		const user = {
			id: faker.string.uuid(),
			email: faker.internet.email(),
			cpf: null,
			passwordHash,
		};

		prismaMock.user.findUnique.mockResolvedValue(user);

		const response = await app.inject({
			method: "POST",
			url: "/sessions/password",
			body: { identifier: user.email, password },
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toHaveProperty("accessToken");
		expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
			where: { email: user.email },
		});
	});

	it("returns access token with a valid CPF and password", async () => {
		const password = "secret123";
		const passwordHash = await hash(password, 6);
		const user = {
			id: faker.string.uuid(),
			email: faker.internet.email(),
			cpf: "52998224725",
			passwordHash,
		};

		prismaMock.user.findUnique.mockResolvedValue(user);

		const response = await app.inject({
			method: "POST",
			url: "/sessions/password",
			body: { identifier: VALID_CPF, password },
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toHaveProperty("accessToken");
		expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
			where: { cpf: "52998224725" },
		});
	});

	it("returns 400 INVALID_IDENTIFIER for a malformed e-mail", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/sessions/password",
			body: { identifier: "not-an-email@", password: "any-password" },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_IDENTIFIER",
		});
		expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
	});

	it("returns 400 INVALID_IDENTIFIER for an invalid CPF checksum", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/sessions/password",
			body: { identifier: "529.982.247-26", password: "any-password" },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_IDENTIFIER",
		});
		expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
	});

	it("returns 400 INVALID_CREDENTIALS when no user matches the e-mail", async () => {
		prismaMock.user.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "POST",
			url: "/sessions/password",
			body: { identifier: faker.internet.email(), password: "any-password" },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_CREDENTIALS",
		});
	});

	it("returns 400 INVALID_CREDENTIALS when no user matches the CPF", async () => {
		prismaMock.user.findUnique.mockResolvedValue(null);

		const response = await app.inject({
			method: "POST",
			url: "/sessions/password",
			body: { identifier: VALID_CPF, password: "any-password" },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_CREDENTIALS",
		});
	});

	it("returns 400 USER_HAS_NO_PASSWORD when the user has no password set", async () => {
		prismaMock.user.findUnique.mockResolvedValue({
			id: faker.string.uuid(),
			email: faker.internet.email(),
			cpf: null,
			passwordHash: null,
		});

		const response = await app.inject({
			method: "POST",
			url: "/sessions/password",
			body: { identifier: faker.internet.email(), password: "any-password" },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "USER_HAS_NO_PASSWORD",
		});
	});

	it("returns 400 INVALID_CREDENTIALS when password does not match", async () => {
		const passwordHash = await hash("correct-password", 6);
		prismaMock.user.findUnique.mockResolvedValue({
			id: faker.string.uuid(),
			email: faker.internet.email(),
			cpf: null,
			passwordHash,
		});

		const response = await app.inject({
			method: "POST",
			url: "/sessions/password",
			body: { identifier: faker.internet.email(), password: "wrong-password" },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_CREDENTIALS",
		});
	});

	it("returns 400 validation error when identifier is missing", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/sessions/password",
			body: { password: "secret123" },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});
});
