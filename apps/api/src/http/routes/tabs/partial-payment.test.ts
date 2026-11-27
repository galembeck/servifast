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
import { registerPartialPayment } from "@/lib/partial-payment";
import { buildApp } from "@/test/helpers/build-app";
import { mockMembership } from "@/test/helpers/membership";
import { signToken } from "@/test/helpers/sign-token";
import { prismaMock, resetPrismaMocks } from "../../../test/mocks/prisma.js";

vi.mock("@/lib/prisma", async () => {
	const { prismaMock } = await import("../../../test/mocks/prisma.js");
	return { prisma: prismaMock };
});
vi.mock("@/lib/partial-payment", () => ({
	registerPartialPayment: vi.fn(),
	settlePartialTab: vi.fn(),
}));
describe("partial receipt authorization and validation", () => {
	let app: Awaited<ReturnType<typeof buildApp>>,
		user: string,
		restaurant: ReturnType<typeof mockMembership>["restaurant"],
		headers: { authorization: string };
	const tabId = randomUUID();
	beforeAll(async () => {
		app = await buildApp();
	});
	afterAll(async () => {
		await app.close();
	});
	beforeEach(() => {
		resetPrismaMocks();
		vi.mocked(registerPartialPayment).mockReset().mockResolvedValue(null);
		user = randomUUID();
		restaurant = mockMembership(user).restaurant;
		headers = { authorization: `Bearer ${signToken(app, user)}` };
	});
	function post(amountInCents = 3000, auth = headers) {
		return app.inject({
			method: "POST",
			url: `/restaurants/${restaurant.slug}/tabs/${tabId}/partial-payment`,
			headers: auth,
			body: { requestId: randomUUID(), amountInCents, method: "PIX" },
		});
	}
	it.each([
		"OWNER",
		"CASHIER",
		"MANAGER",
	] as const)("allows %s with scoped server restaurant", async (role) => {
		restaurant = mockMembership(user, role).restaurant;
		expect((await post()).statusCode).toBe(200);
		expect(registerPartialPayment).toHaveBeenCalledWith(
			expect.anything(),
			tabId,
			restaurant.id,
			user,
			expect.objectContaining({ amountInCents: 3000 })
		);
	});
	it.each([
		"WAITER",
		"KITCHEN",
		"BILLING",
	] as const)("denies %s", async (role) => {
		restaurant = mockMembership(user, role).restaurant;
		expect((await post()).statusCode).toBe(403);
		expect(registerPartialPayment).not.toHaveBeenCalled();
	});
	it("requires authentication and membership", async () => {
		expect((await post(3000, {} as typeof headers)).statusCode).toBe(401);
		prismaMock.member.findFirst.mockResolvedValue(null);
		expect((await post()).statusCode).toBe(401);
		expect(registerPartialPayment).not.toHaveBeenCalled();
	});
	it.each([0, -1, 1.5])("rejects malformed amount %s", async (amount) => {
		expect((await post(amount)).statusCode).toBe(400);
		expect(registerPartialPayment).not.toHaveBeenCalled();
	});
	it("requires a request identifier", async () => {
		expect(
			(
				await app.inject({
					method: "POST",
					url: `/restaurants/${restaurant.slug}/tabs/${tabId}/partial-payment`,
					headers,
					body: { amountInCents: 3000, method: "PIX" },
				})
			).statusCode
		).toBe(400);
	});
});
