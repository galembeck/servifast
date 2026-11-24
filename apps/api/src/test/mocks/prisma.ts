import { vi } from "vitest";

export const prismaMock = {
	user: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
	restaurant: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
	member: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		count: vi.fn(),
	},
	invite: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		delete: vi.fn(),
	},
	table: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		updateMany: vi.fn(),
		delete: vi.fn(),
	},
	menuCategory: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
	menuItem: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
	expense: {
		updateManyAndReturn: vi.fn(),
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
	tab: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
	orderItem: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		updateMany: vi.fn(),
		delete: vi.fn(),
	},
	kdsEvent: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
	billSplit: { findFirst: vi.fn(), findUnique: vi.fn() },
	payment: {
		aggregate: vi.fn(),
	},
	cashRegisterSession: {
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		updateMany: vi.fn(),
	},
	cashRegisterTransaction: {
		findMany: vi.fn(),
		create: vi.fn(),
	},
	token: {
		findUnique: vi.fn(),
		create: vi.fn(),
		delete: vi.fn(),
	},
	account: {
		findUnique: vi.fn(),
		create: vi.fn(),
	},
	$transaction: vi.fn(),
	$queryRawUnsafe: vi.fn(),
};

export function resetPrismaMocks() {
	for (const delegate of Object.values(prismaMock)) {
		if (typeof delegate === "object" && delegate !== null) {
			for (const fn of Object.values(delegate)) {
				if (typeof fn === "function" && "mockReset" in fn) {
					(fn as ReturnType<typeof vi.fn>).mockReset();
				}
			}
		} else if (typeof delegate === "function" && "mockReset" in delegate) {
			(delegate as ReturnType<typeof vi.fn>).mockReset();
		}
	}
}
