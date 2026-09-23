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

describe("POST /restaurants/:slug/expenses", () => {
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

	it("registers an expense when user is OWNER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const expenseId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.expense.create.mockResolvedValue({ id: expenseId });

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/expenses`,
			headers: { Authorization: `Bearer ${token}` },
			body: {
				category: "Ingredientes",
				amount: 150.5,
				date: "2026-09-20",
			},
		});

		expect(response.statusCode).toBe(201);
		expect(JSON.parse(response.body)).toMatchObject({ expenseId });
		expect(prismaMock.expense.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					category: "Ingredientes",
					amountInCents: 15_050,
					restaurantId: restaurant.id,
				}),
			})
		);
	});

	it("registers an expense when user is MANAGER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "MANAGER");
		const expenseId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.expense.create.mockResolvedValue({ id: expenseId });

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/expenses`,
			headers: { Authorization: `Bearer ${token}` },
			body: { category: "Aluguel", amount: 2000, date: "2026-09-01" },
		});

		expect(response.statusCode).toBe(201);
	});

	it("registers an expense when user is CASHIER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "CASHIER");
		const expenseId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.expense.create.mockResolvedValue({ id: expenseId });

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/expenses`,
			headers: { Authorization: `Bearer ${token}` },
			body: { category: "Manutenção", amount: 89.9, date: "2026-09-10" },
		});

		expect(response.statusCode).toBe(201);
	});

	it("registers an expense when user is BILLING", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "BILLING");
		const expenseId = faker.string.uuid();
		const token = signToken(app, userId);

		prismaMock.expense.create.mockResolvedValue({ id: expenseId });

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/expenses`,
			headers: { Authorization: `Bearer ${token}` },
			body: { category: "Impostos", amount: 500, date: "2026-09-05" },
		});

		expect(response.statusCode).toBe(201);
	});

	it("returns 401 UNAUTHORIZED when user is WAITER", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "WAITER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/expenses`,
			headers: { Authorization: `Bearer ${token}` },
			body: { category: "Outros", amount: 10, date: "2026-09-01" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 401 UNAUTHORIZED when user is KITCHEN", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "KITCHEN");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/expenses`,
			headers: { Authorization: `Bearer ${token}` },
			body: { category: "Outros", amount: 10, date: "2026-09-01" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "UNAUTHORIZED",
		});
	});

	it("returns 400 validation error when amount is missing", async () => {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, "OWNER");
		const token = signToken(app, userId);

		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/expenses`,
			headers: { Authorization: `Bearer ${token}` },
			body: { category: "Outros", date: "2026-09-01" },
		});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "Validation error",
		});
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/restaurants/some-restaurant/expenses",
			body: { category: "Outros", amount: 10, date: "2026-09-01" },
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
