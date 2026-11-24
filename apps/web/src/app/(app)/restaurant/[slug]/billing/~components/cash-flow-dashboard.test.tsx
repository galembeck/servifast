import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type CashFlowReport,
	getCashFlow,
} from "@/api/http/services/get-cash-flow";
import { CashFlowDashboard } from "./cash-flow-dashboard";

vi.mock("@/api/http/services/get-cash-flow", () => ({ getCashFlow: vi.fn() }));
vi.mock("next/navigation", () => ({
	usePathname: () => "/restaurant/test/billing",
}));
// Recharts' geometry requires a browser; real SVG rendering is covered in Edge.
vi.mock("recharts", () => ({
	ResponsiveContainer: () => null,
	Bar: () => null,
	BarChart: () => null,
	CartesianGrid: () => null,
	Legend: () => null,
	Tooltip: () => null,
	XAxis: () => null,
	YAxis: () => null,
}));
const report: CashFlowReport = {
	period: "today",
	granularity: "day",
	generatedAt: "2026-11-24T15:00:00Z",
	range: { start: "2026-11-24T03:00:00Z", end: "2026-11-25T03:00:00Z" },
	totals: {
		incomingInCents: 12_000,
		outgoingInCents: 15_000,
		netInCents: -3000,
	},
	series: [
		{
			bucket: "2026-11-24",
			incomingInCents: 12_000,
			outgoingInCents: 15_000,
			netInCents: -3000,
		},
	],
};
let client: QueryClient;
function show(period: "today" | "week" | "month" = "today") {
	return render(
		<QueryClientProvider client={client}>
			<CashFlowDashboard period={period} slug="test" />
		</QueryClientProvider>
	);
}
beforeEach(() => {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	vi.mocked(getCashFlow).mockReset();
});
afterEach(() => {
	cleanup();
	client.clear();
});
describe("cash flow dashboard", () => {
	it("shows loading and reuses the period selector", () => {
		vi.mocked(getCashFlow).mockReturnValue(
			new Promise(() => {
				/* Keep the request pending to inspect loading. */
			})
		);
		show();
		expect(screen.getByRole("status").textContent).toContain("Carregando");
		expect(
			screen.getByRole("link", { name: "Semana" }).getAttribute("href")
		).toBe("/restaurant/test/billing?period=week");
	});
	it("formats amounts in reais including a negative balance and provides chart data", async () => {
		vi.mocked(getCashFlow).mockResolvedValue(report);
		show();
		await screen.findByText("Saldo Líquido Consolidado");
		expect(
			document.body.textContent
				?.replaceAll(String.fromCharCode(160), "")
				.replaceAll(" ", "")
		).toContain("-R$30,00");
		expect(
			screen.getByRole("img", { name: "Gráfico de entradas e saídas por dia" })
		).toBeTruthy();
		fireEvent.click(screen.getByText("Ver dados do fluxo em tabela"));
		expect(screen.getByRole("table").textContent).toContain("24/11");
	});
	it("shows an empty period with zero totals", async () => {
		vi.mocked(getCashFlow).mockResolvedValue({
			...report,
			totals: { incomingInCents: 0, outgoingInCents: 0, netInCents: 0 },
			series: [],
		});
		show();
		expect(
			await screen.findByText("Nenhuma movimentação no período.")
		).toBeTruthy();
		expect(screen.queryByRole("img")).toBeNull();
	});
	it("shows an error and permits a retry", async () => {
		vi.mocked(getCashFlow)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue(report);
		show();
		await screen.findByRole("alert");
		fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
		await screen.findByText("Saldo Líquido Consolidado");
		expect(screen.queryByRole("alert")).toBeNull();
	});
	it("fetches a new period without showing the previous period as its result", async () => {
		vi.mocked(getCashFlow)
			.mockResolvedValueOnce(report)
			.mockReturnValue(
				new Promise(() => {
					/* Keep the request pending to inspect loading. */
				})
			);
		const view = show();
		await screen.findByText("Saldo Líquido Consolidado");
		view.rerender(
			<QueryClientProvider client={client}>
				<CashFlowDashboard period="week" slug="test" />
			</QueryClientProvider>
		);
		await waitFor(() =>
			expect(getCashFlow).toHaveBeenLastCalledWith("test", "week")
		);
		expect(screen.queryByText("Saldo Líquido Consolidado")).toBeNull();
		expect(screen.getByRole("status").textContent).toContain("Carregando");
	});
});
