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
import {
	createBillSplit,
	payBillInvoice,
	previewBillSplit,
	readBillSplit,
} from "@/lib/bill-split";
import { buildApp } from "@/test/helpers/build-app";
import { mockMembership } from "@/test/helpers/membership";
import { signToken } from "@/test/helpers/sign-token";
import { prismaMock, resetPrismaMocks } from "../../../test/mocks/prisma.js";

vi.mock("@/lib/prisma", async () => {
	const { prismaMock } = await import("../../../test/mocks/prisma.js");
	return { prisma: prismaMock };
});
vi.mock("@/lib/bill-split", () => ({
	previewBillSplit: vi.fn(),
	createBillSplit: vi.fn(),
	payBillInvoice: vi.fn(),
	readBillSplit: vi.fn(),
}));
describe("checkout split authorization and validation", () => {
	let app: Awaited<ReturnType<typeof buildApp>>;
	let user: string, restaurant: ReturnType<typeof mockMembership>["restaurant"];
	let headers: { authorization: string };
	const tabId = randomUUID(),
		invoice = randomUUID();
	beforeAll(async () => {
		app = await buildApp();
	});
	afterAll(async () => {
		await app.close();
	});
	beforeEach(() => {
		resetPrismaMocks();
		vi.mocked(previewBillSplit)
			.mockReset()
			.mockResolvedValue({
				fingerprint: "a".repeat(64),
				totals: {
					subtotalInCents: 10_000,
					serviceFeeInCents: 0,
					discountInCents: 0,
					amountInCents: 10_000,
				},
				parts: [],
			});
		vi.mocked(createBillSplit).mockReset().mockResolvedValue(null);
		vi.mocked(payBillInvoice).mockReset().mockResolvedValue(null);
		vi.mocked(readBillSplit).mockReset().mockResolvedValue(null);
		user = randomUUID();
		restaurant = mockMembership(user).restaurant;
		headers = { authorization: `Bearer ${signToken(app, user)}` };
		prismaMock.tab.findUnique.mockResolvedValue({ id: tabId });
	});
	function preview() {
		return app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/split/preview`,
			headers,
			body: { requestId: randomUUID(), mode: "PEOPLE", people: 3 },
		});
	}
	it.each([
		"OWNER",
		"CASHIER",
		"MANAGER",
	] as const)("allows checkout role %s and passes server restaurant scope", async (role) => {
		restaurant = mockMembership(user, role).restaurant;
		expect((await preview()).statusCode).toBe(200);
		expect(previewBillSplit).toHaveBeenCalledWith(
			expect.anything(),
			tabId,
			restaurant.id,
			expect.objectContaining({ people: 3 })
		);
		const paid = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/split/${invoice}/pay`,
			headers,
			body: { method: "PIX" },
		});
		expect(paid.statusCode).toBe(200);
		expect(payBillInvoice).toHaveBeenCalledWith(
			expect.anything(),
			tabId,
			restaurant.id,
			invoice,
			user,
			{ method: "PIX" }
		);
	});
	it.each([
		"WAITER",
		"KITCHEN",
		"BILLING",
	] as const)("blocks %s", async (role) => {
		restaurant = mockMembership(user, role).restaurant;
		expect((await preview()).statusCode).toBe(403);
		expect(previewBillSplit).not.toHaveBeenCalled();
	});
	it("requires authentication", async () => {
		headers = { authorization: "" };
		expect((await preview()).statusCode).toBe(401);
		expect(previewBillSplit).not.toHaveBeenCalled();
	});
	it("blocks a foreign restaurant", async () => {
		prismaMock.member.findFirst.mockResolvedValue(null);
		expect((await preview()).statusCode).toBe(401);
		expect(previewBillSplit).not.toHaveBeenCalled();
	});
	it("rejects an invalid number of people", async () => {
		const r = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/split/preview`,
			headers,
			body: { mode: "PEOPLE", requestId: randomUUID(), people: 0 },
		});
		expect(r.statusCode).toBe(400);
		expect(previewBillSplit).not.toHaveBeenCalled();
	});
	it("rejects invalid quantities before reaching the split service", async () => {
		const r = await app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/split/preview`,
			headers,
			body: {
				mode: "ITEMS",
				requestId: randomUUID(),
				clients: [
					{ name: "A", items: [{ itemId: randomUUID(), quantity: 0 }] },
					{ name: "B", items: [{ itemId: randomUUID(), quantity: 1 }] },
				],
			},
		});
		expect(r.statusCode).toBe(400);
	});
	it("supports reloading persisted state", async () => {
		const r = await app.inject({
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/split`,
			headers,
		});
		expect(r.statusCode).toBe(200);
		expect(readBillSplit).toHaveBeenCalledWith(
			expect.anything(),
			tabId,
			restaurant.id
		);
	});
});
