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

type Role = Parameters<typeof mockMembership>[1];

describe("PATCH /restaurants/:slug/tabs/:tabId/request-bill", () => {
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

	const tabId = faker.string.uuid();
	const tableId = faker.string.uuid();

	function requestBill(role: Role) {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		return app.inject({
			method: "PATCH",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/request-bill`,
			headers: { Authorization: `Bearer ${token}` },
		});
	}

	it.each([
		"WAITER",
		"MANAGER",
		"OWNER",
	] as const)("moves the table to BILL_REQUESTED for %s", async (role) => {
		prismaMock.tab.findUnique.mockResolvedValue({ closedAt: null, tableId });
		prismaMock.table.updateMany.mockResolvedValue({ count: 1 });

		const response = await requestBill(role);

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			table: { id: tableId, status: "BILL_REQUESTED" },
		});
		expect(prismaMock.table.updateMany).toHaveBeenCalledWith({
			where: { id: tableId, status: "OCCUPIED" },
			data: { status: "BILL_REQUESTED" },
		});
	});

	it("returns 409 TABLE_NOT_OCCUPIED when the bill was already requested", async () => {
		prismaMock.tab.findUnique.mockResolvedValue({ closedAt: null, tableId });
		prismaMock.table.updateMany.mockResolvedValue({ count: 0 });

		const response = await requestBill("WAITER");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TABLE_NOT_OCCUPIED",
		});
	});

	it("returns 409 TAB_NOT_OPEN when the tab is closed", async () => {
		prismaMock.tab.findUnique.mockResolvedValue({
			closedAt: new Date(),
			tableId,
		});

		const response = await requestBill("WAITER");

		expect(response.statusCode).toBe(409);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_OPEN",
		});
		expect(prismaMock.table.updateMany).not.toHaveBeenCalled();
	});

	it("returns 404 TAB_NOT_FOUND when the tab does not exist", async () => {
		prismaMock.tab.findUnique.mockResolvedValue(null);

		const response = await requestBill("WAITER");

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TAB_NOT_FOUND",
		});
	});

	it.each([
		"CASHIER",
		"KITCHEN",
		"BILLING",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const response = await requestBill(role);

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.tab.findUnique).not.toHaveBeenCalled();
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "PATCH",
			url: `/restaurants/some-restaurant/tabs/${tabId}/request-bill`,
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
