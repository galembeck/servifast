import { randomUUID } from "node:crypto";
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
describe("financial entry settlement", () => {
	let app: Awaited<ReturnType<typeof buildApp>>;
	let userId: string;
	let id: string;
	let restaurant: ReturnType<typeof mockMembership>["restaurant"];
	let headers: { authorization: string };
	beforeAll(async () => {
		app = await buildApp();
	});
	afterAll(async () => {
		await app.close();
	});
	beforeEach(() => {
		resetPrismaMocks();
		userId = randomUUID();
		id = randomUUID();
		restaurant = mockMembership(userId).restaurant;
		headers = { authorization: `Bearer ${signToken(app, userId)}` };
	});
	function pay(body: object = { effectiveDate: "2026-11-23" }) {
		return app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/financial-entries/${id}/pay`,
			headers,
			body,
		});
	}
	it.each([
		["EXPENSE", "PAID"],
		["INCOME", "RECEIVED"],
	])("settles %s as %s with separate date and server timestamp", async (type, status) => {
		const entry = {
			id,
			category: "Teste",
			amountInCents: 150,
			type,
			status: "PENDING",
			settledOn: null,
			settledAt: null,
		};
		prismaMock.expense.findFirst.mockResolvedValue(entry);
		prismaMock.expense.updateManyAndReturn.mockImplementation(({ data }) =>
			Promise.resolve([{ ...entry, ...data }])
		);
		const before = Date.now();
		const response = await pay();
		const after = Date.now();
		expect(response.statusCode).toBe(200);
		const result = response.json().entry;
		expect(result).toMatchObject({ status, settledOn: "2026-11-23" });
		expect(Date.parse(result.settledAt)).toBeGreaterThanOrEqual(before);
		expect(Date.parse(result.settledAt)).toBeLessThanOrEqual(after);
		expect(prismaMock.expense.updateManyAndReturn).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id, restaurantId: restaurant.id, type, status: "PENDING" },
			})
		);
	});
	it.each([
		{},
		{ effectiveDate: "" },
		{ effectiveDate: "2026-02-30" },
		{ effectiveDate: "2025-02-29" },
		{ effectiveDate: "2026-11-23T00:00:00Z" },
		{ effectiveDate: null },
	])("rejects invalid or absent dates: %j", async (body) => {
		expect((await pay(body)).statusCode).toBe(400);
		expect(prismaMock.expense.updateManyAndReturn).not.toHaveBeenCalled();
	});
	it.each([
		"MANAGER",
		"CASHIER",
		"KITCHEN",
		"WAITER",
		"BILLING",
	] as const)("rejects %s", async (role) => {
		restaurant = mockMembership(userId, role).restaurant;
		expect((await pay()).statusCode).toBe(403);
		expect(prismaMock.expense.findFirst).not.toHaveBeenCalled();
		expect(prismaMock.expense.updateManyAndReturn).not.toHaveBeenCalled();
	});
	it("rejects an OWNER who does not own this restaurant", async () => {
		prismaMock.member.findFirst.mockResolvedValue({
			role: "OWNER",
			userId,
			restaurant: { ...restaurant, ownerId: randomUUID() },
		});
		expect((await pay()).statusCode).toBe(403);
		expect(prismaMock.expense.updateManyAndReturn).not.toHaveBeenCalled();
	});
	it("rejects missing authentication", async () => {
		headers = { authorization: "" };
		expect((await pay()).statusCode).toBe(401);
		expect(prismaMock.expense.updateManyAndReturn).not.toHaveBeenCalled();
	});
	it("does not expose or change an entry from another restaurant", async () => {
		prismaMock.expense.findFirst.mockResolvedValue(null);
		expect((await pay()).statusCode).toBe(404);
		expect(prismaMock.expense.findFirst).toHaveBeenCalledWith({
			where: { id, restaurantId: restaurant.id },
		});
		expect(prismaMock.expense.updateManyAndReturn).not.toHaveBeenCalled();
	});
	it("returns a conflict when an entry has already been settled or a concurrent request won", async () => {
		prismaMock.expense.findFirst.mockResolvedValue({ id, type: "EXPENSE" });
		prismaMock.expense.updateManyAndReturn.mockResolvedValue([]);
		const response = await pay();
		expect(response.statusCode).toBe(409);
		expect(response.json().message).toBe("FINANCIAL_ENTRY_NOT_PENDING");
	});
	it("lists the restaurant's entries without shifting calendar days", async () => {
		prismaMock.expense.findMany.mockResolvedValue([
			{
				id,
				category: "Teste",
				amountInCents: 150,
				type: "EXPENSE",
				status: "PAID",
				settledOn: new Date("2026-11-23T00:00:00Z"),
				settledAt: new Date("2026-11-24T15:00:00Z"),
			},
		]);
		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/financial-entries`,
			headers,
		});
		expect(response.statusCode).toBe(200);
		expect(response.json().entries[0].settledOn).toBe("2026-11-23");
		expect(prismaMock.expense.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { restaurantId: restaurant.id } })
		);
	});
	it("preserves the existing expense registration contract and accepts an income", async () => {
		prismaMock.expense.create.mockResolvedValue({ id });
		for (const type of [undefined, "INCOME"]) {
			const response = await app.inject({
				method: "POST",
				url: `/restaurants/${restaurant.slug}/expenses`,
				headers,
				body: {
					category: "Teste",
					amount: 1,
					date: "2026-11-23",
					...(type ? { type } : {}),
				},
			});
			expect(response.statusCode).toBe(201);
			expect(response.json()).toEqual({ expenseId: id });
			expect(prismaMock.expense.create).toHaveBeenLastCalledWith({
				data: expect.objectContaining({ type: type ?? "EXPENSE" }),
			});
		}
	});
	it("allows browser PATCH preflight", async () => {
		const response = await app.inject({
			method: "OPTIONS",
			url: `/restaurants/${restaurant.slug}/financial-entries/${id}/pay`,
			headers: {
				origin: "http://localhost:3000",
				"access-control-request-method": "PATCH",
				"access-control-request-headers": "authorization,content-type",
			},
		});
		expect(response.statusCode).toBe(204);
		expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
	});
	it("protects the listing from non-owners", async () => {
		restaurant = mockMembership(userId, "MANAGER").restaurant;
		const response = await app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/financial-entries`,
			headers,
		});
		expect(response.statusCode).toBe(403);
		expect(prismaMock.expense.findMany).not.toHaveBeenCalled();
	});
	it("does not let the old expense creation permission create income for a manager", async () => {
		restaurant = mockMembership(userId, "MANAGER").restaurant;
		const response = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/expenses`,
			headers,
			body: {
				category: "Teste",
				type: "INCOME",
				amount: 1,
				date: "2026-11-23",
			},
		});
		expect(response.statusCode).toBe(401);
		expect(prismaMock.expense.create).not.toHaveBeenCalled();
	});
});
