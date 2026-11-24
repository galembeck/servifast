import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type BillSplit, getBillSplit } from "@/api/http/services/bill-split";
import { payInvoiceAction } from "../~actions/actions";
import { SplitBillPanel } from "./split-bill-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/api/http/services/bill-split", () => ({ getBillSplit: vi.fn() }));
vi.mock("../~actions/actions", () => ({ payInvoiceAction: vi.fn() }));
const pending = {
	id: "two",
	position: 2,
	name: "Pessoa 2",
	amountInCents: 5000,
	subtotalInCents: null,
	serviceFeeInCents: null,
	discountInCents: null,
	items: [],
	payment: null,
};
const state: BillSplit = {
	id: "split",
	mode: "PEOPLE",
	subtotalInCents: 10_000,
	serviceFeeInCents: 0,
	discountInCents: 0,
	amountInCents: 10_000,
	paidInCents: 5000,
	remainingInCents: 5000,
	closedAt: null,
	invoices: [
		{
			...pending,
			id: "one",
			position: 1,
			name: "Pessoa 1",
			payment: {
				id: "payment",
				method: "CASH",
				amountInCents: 5000,
				receivedInCents: 6000,
				changeInCents: 1000,
				createdAt: "2026-11-24T12:00:00Z",
			},
		},
		pending,
	],
};
let query: QueryClient;
function show() {
	render(
		<QueryClientProvider client={query}>
			<SplitBillPanel restaurant="test" tabId="tab" />
		</QueryClientProvider>
	);
}
beforeEach(() => {
	query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	vi.mocked(getBillSplit).mockReset().mockResolvedValue({ split: state });
	vi.mocked(payInvoiceAction).mockReset();
});
afterEach(() => {
	cleanup();
	query.clear();
});
describe("persisted split invoices", () => {
	it("shows paid and pending invoices and remaining balance from the server", async () => {
		show();
		await screen.findByText("Conta dividida");
		expect(screen.getByText("Pendente")).toBeTruthy();
		expect(screen.getByText("Pago · Dinheiro")).toBeTruthy();
		expect(
			screen.getAllByRole("button", { name: "Pagar parcela" })
		).toHaveLength(1);
		expect(screen.getByRole("region").textContent).toContain("Saldo restante:");
	});
	it("pays the last invoice and updates the closed state", async () => {
		const first = state.invoices[0];
		if (!first) {
			throw new Error("Missing fixture");
		}
		const settled = {
			...state,
			paidInCents: 10_000,
			remainingInCents: 0,
			closedAt: "2026-11-24T12:01:00Z",
			invoices: [
				first,
				{
					...pending,
					payment: {
						id: "second",
						method: "PIX" as const,
						amountInCents: 5000,
						receivedInCents: null,
						changeInCents: null,
						createdAt: "2026-11-24T12:01:00Z",
					},
				},
			],
		};
		vi.mocked(payInvoiceAction).mockResolvedValue({
			success: true,
			split: settled,
		});
		show();
		fireEvent.click(
			await screen.findByRole("button", { name: "Pagar parcela" })
		);
		fireEvent.click(screen.getByRole("button", { name: "PIX" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Confirmar pagamento" })
		);
		await screen.findByText("Conta liquidada. Mesa liberada.");
		await waitFor(() =>
			expect(payInvoiceAction).toHaveBeenCalledWith("tab", "two", {
				method: "PIX",
			})
		);
		expect(screen.queryByRole("button", { name: "Pagar parcela" })).toBeNull();
	});
});
