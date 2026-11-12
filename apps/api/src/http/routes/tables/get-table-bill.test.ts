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

describe("GET /restaurants/:slug/tables/:tableId/bill", () => {
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

	const tableId = faker.string.uuid();
	const tabId = faker.string.uuid();
	const pizza = { id: faker.string.uuid(), name: "Pizza Margherita" };
	const soda = { id: faker.string.uuid(), name: "Refrigerante Lata" };
	const sentAt = new Date();

	function makeItem(
		menuItem: { id: string; name: string },
		overrides: Partial<{
			quantity: number;
			unitPriceInCents: number;
			status: string;
			sentToKitchenAt: Date | null;
		}> = {}
	) {
		return {
			quantity: 1,
			unitPriceInCents: 1000,
			status: "DELIVERED",
			sentToKitchenAt: sentAt,
			menuItem,
			...overrides,
		};
	}

	function mockTable(items: ReturnType<typeof makeItem>[], hasOpenTab = true) {
		prismaMock.table.findUnique.mockResolvedValue({
			id: tableId,
			number: 8,
			status: "BILL_REQUESTED",
			tabs: hasOpenTab
				? [
						{
							id: tabId,
							customerName: "Juliana",
							peopleCount: 3,
							openedAt: new Date(),
							items,
						},
					]
				: [],
		});
	}

	function getBill(role: Role) {
		const userId = faker.string.uuid();
		const { restaurant } = mockMembership(userId, role);
		const token = signToken(app, userId);

		return app.inject({
			method: "GET",
			url: `/restaurants/${restaurant.slug}/tables/${tableId}/bill`,
			headers: { Authorization: `Bearer ${token}` },
		});
	}

	it("groups confirmed items and sums the subtotal for CASHIER", async () => {
		mockTable([
			makeItem(pizza, { quantity: 1, unitPriceInCents: 5990 }),
			makeItem(soda, { quantity: 2, unitPriceInCents: 700, status: "READY" }),
			makeItem(pizza, {
				quantity: 2,
				unitPriceInCents: 5990,
				status: "PREPARING",
			}),
		]);

		const response = await getBill("CASHIER");

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			bill: {
				table: { id: tableId, number: 8, status: "BILL_REQUESTED" },
				tab: { id: tabId, customerName: "Juliana", peopleCount: 3 },
				items: [
					{
						menuItemId: pizza.id,
						name: pizza.name,
						quantity: 3,
						unitPriceInCents: 5990,
						totalInCents: 17_970,
					},
					{
						menuItemId: soda.id,
						quantity: 2,
						unitPriceInCents: 700,
						totalInCents: 1400,
					},
				],
				subtotalInCents: 19_370,
				cancelledItemsCount: 0,
				unconfirmedItemsCount: 0,
			},
		});
	});

	it("leaves cancelled and unconfirmed (draft) items out of the subtotal", async () => {
		mockTable([
			makeItem(pizza, { unitPriceInCents: 5990 }),
			makeItem(pizza, { unitPriceInCents: 5990, status: "CANCELLED" }),
			makeItem(soda, {
				unitPriceInCents: 700,
				status: "RECEIVED",
				sentToKitchenAt: null,
			}),
		]);

		const response = await getBill("CASHIER");
		const { bill } = JSON.parse(response.body);

		expect(response.statusCode).toBe(200);
		expect(bill.items).toHaveLength(1);
		expect(bill.subtotalInCents).toBe(5990);
		expect(bill.cancelledItemsCount).toBe(1);
		expect(bill.unconfirmedItemsCount).toBe(1);
	});

	it("keeps the same item at different prices on separate lines", async () => {
		mockTable([
			makeItem(pizza, { unitPriceInCents: 5990 }),
			makeItem(pizza, { unitPriceInCents: 6490 }),
		]);

		const response = await getBill("CASHIER");
		const { bill } = JSON.parse(response.body);

		expect(bill.items).toHaveLength(2);
		expect(bill.subtotalInCents).toBe(12_480);
	});

	it("returns an empty bill with zero subtotal when nothing was confirmed", async () => {
		mockTable([]);

		const response = await getBill("WAITER");

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toMatchObject({
			bill: { items: [], subtotalInCents: 0 },
		});
	});

	it.each([
		"OWNER",
		"MANAGER",
		"WAITER",
	] as const)("allows %s to view the bill", async (role) => {
		mockTable([makeItem(pizza)]);

		const response = await getBill(role);

		expect(response.statusCode).toBe(200);
	});

	it("returns 404 TABLE_HAS_NO_OPEN_TAB when the table is free", async () => {
		mockTable([], false);

		const response = await getBill("CASHIER");

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TABLE_HAS_NO_OPEN_TAB",
		});
	});

	it("returns 404 TABLE_NOT_FOUND when the table does not exist", async () => {
		prismaMock.table.findUnique.mockResolvedValue(null);

		const response = await getBill("CASHIER");

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "TABLE_NOT_FOUND",
		});
	});

	it.each([
		"KITCHEN",
		"BILLING",
	] as const)("returns 403 FORBIDDEN for %s", async (role) => {
		const response = await getBill(role);

		expect(response.statusCode).toBe(403);
		expect(JSON.parse(response.body)).toMatchObject({ message: "FORBIDDEN" });
		expect(prismaMock.table.findUnique).not.toHaveBeenCalled();
	});

	it("returns 401 INVALID_TOKEN when not authenticated", async () => {
		const response = await app.inject({
			method: "GET",
			url: `/restaurants/some-restaurant/tables/${tableId}/bill`,
		});

		expect(response.statusCode).toBe(401);
		expect(JSON.parse(response.body)).toMatchObject({
			message: "INVALID_TOKEN",
		});
	});
});
