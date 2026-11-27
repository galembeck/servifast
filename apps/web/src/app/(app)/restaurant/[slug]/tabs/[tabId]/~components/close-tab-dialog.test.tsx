import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TabItem } from "@/api/http/services/get-tab";
import { closeTabAction, partialPaymentAction } from "../~actions/actions";
import { CloseTabDialog } from "./close-tab-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./split-bill-builder", () => ({ SplitBillBuilder: () => null }));
vi.mock("../~actions/actions", () => ({
	closeTabAction: vi.fn(),
	partialPaymentAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const item: TabItem = {
	id: "00000000-0000-4000-8000-000000000001",
	quantity: 1,
	unitPriceInCents: 7550,
	status: "DELIVERED",
	notes: null,
	sentToKitchenAt: null,
	deliveredAt: "2026-11-24T12:00:00Z",
	createdAt: "2026-11-24T12:00:00Z",
	menuItem: {
		id: "00000000-0000-4000-8000-000000000002",
		name: "Teste",
		imageUrl: null,
	},
};
const CONFIRM_BUTTON = /Confirmar/;
function show() {
	render(
		<CloseTabDialog
			items={[item]}
			restaurant="test"
			tabId="00000000-0000-4000-8000-000000000003"
		/>
	);
	fireEvent.click(screen.getByRole("button", { name: "Fechar conta" }));
}
function summary() {
	return screen
		.getByLabelText("Resumo do pagamento")
		.textContent?.replace(/\s/g, "");
}
beforeEach(() => {
	vi.mocked(closeTabAction).mockReset();
	vi.mocked(closeTabAction).mockResolvedValue({
		success: false,
		title: "Teste",
	});
});
afterEach(() => {
	cleanup();
});
describe("checkout adjustment preview", () => {
	it("recalculates the optional service fee immediately and restores it after toggling", () => {
		show();
		expect(summary()).toContain("TotalR$75,50");
		fireEvent.click(screen.getByLabelText("Incluir taxa de serviço"));
		fireEvent.change(
			screen.getByLabelText("Taxa de serviço", { exact: true }),
			{ target: { value: "10" } }
		);
		expect(summary()).toContain("TotalR$83,05");
		fireEvent.click(screen.getByLabelText("Incluir taxa de serviço"));
		expect(summary()).toContain("TotalR$75,50");
		fireEvent.click(screen.getByLabelText("Incluir taxa de serviço"));
		expect(
			(
				screen.getByLabelText("Taxa de serviço", {
					exact: true,
				}) as HTMLInputElement
			).value
		).toBe("10");
		expect(summary()).toContain("TotalR$83,05");
	});
	it("uses the currency input to update a fixed discount", () => {
		show();
		fireEvent.change(screen.getByLabelText("Desconto", { exact: true }), {
			target: { value: "R$ 10,00" },
		});
		expect(summary()).toContain("TotalR$65,50");
	});
	it("blocks a negative total and sends no close request", () => {
		show();
		fireEvent.click(screen.getByRole("button", { name: "PIX" }));
		fireEvent.change(screen.getByLabelText("Desconto", { exact: true }), {
			target: { value: "R$ 100,00" },
		});
		expect(screen.getByRole("alert").textContent).toContain("negativo");
		expect(
			(
				screen.getByRole("button", {
					name: CONFIRM_BUTTON,
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
		expect(closeTabAction).not.toHaveBeenCalled();
	});
	it("sends adjustments and cash received while preserving the chosen values on failure", async () => {
		show();
		fireEvent.click(screen.getByLabelText("Incluir taxa de serviço"));
		fireEvent.change(
			screen.getByLabelText("Taxa de serviço", { exact: true }),
			{ target: { value: "10" } }
		);
		fireEvent.change(screen.getByLabelText("Desconto", { exact: true }), {
			target: { value: "R$ 10,00" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Dinheiro" }));
		fireEvent.change(screen.getByLabelText("Valor recebido (R$)"), {
			target: { value: "100,00" },
		});
		fireEvent.click(screen.getByRole("button", { name: CONFIRM_BUTTON }));
		await waitFor(() =>
			expect(closeTabAction).toHaveBeenCalledWith(
				expect.any(String),
				"CASH",
				10_000,
				{
					serviceFee: { type: "PERCENT", basisPoints: 1000 },
					discount: { type: "FIXED", amountInCents: 1000 },
				},
				expect.any(String)
			)
		);
		expect(summary()).toContain("TotalR$73,05");
		expect(screen.getByRole("dialog")).toBeTruthy();
	});
	it("blocks partial values outside the remaining balance", () => {
		show();
		fireEvent.click(screen.getByRole("button", { name: "Pagamento parcial" }));
		fireEvent.click(screen.getByRole("button", { name: "PIX" }));
		expect(
			(
				screen.getByRole("button", {
					name: CONFIRM_BUTTON,
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
		fireEvent.change(screen.getByLabelText("Valor parcial (R$)"), {
			target: { value: "8000" },
		});
		expect(
			(
				screen.getByRole("button", {
					name: CONFIRM_BUTTON,
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
		expect(partialPaymentAction).not.toHaveBeenCalled();
	});
	it("keeps the amount and reuses the request identifier after failure", async () => {
		vi.mocked(partialPaymentAction)
			.mockReset()
			.mockResolvedValue({ success: false, title: "Falha de teste" });
		show();
		fireEvent.click(screen.getByRole("button", { name: "Pagamento parcial" }));
		fireEvent.change(screen.getByLabelText("Valor parcial (R$)"), {
			target: { value: "3000" },
		});
		fireEvent.click(screen.getByRole("button", { name: "PIX" }));
		fireEvent.click(screen.getByRole("button", { name: CONFIRM_BUTTON }));
		await screen.findByText("Falha de teste");
		expect(
			(
				screen.getByLabelText("Valor parcial (R$)") as HTMLInputElement
			).value.replace(/\s/g, "")
		).toBe("R$30,00");
		fireEvent.click(
			await screen.findByRole("button", { name: CONFIRM_BUTTON })
		);
		await waitFor(() => expect(partialPaymentAction).toHaveBeenCalledTimes(2));
		expect(vi.mocked(partialPaymentAction).mock.calls[0]?.[1]).toEqual(
			vi.mocked(partialPaymentAction).mock.calls[1]?.[1]
		);
		expect(vi.mocked(partialPaymentAction).mock.calls[0]?.[1]).toMatchObject({
			amountInCents: 3000,
			method: "PIX",
			requestId: expect.any(String),
		});
	});
});
