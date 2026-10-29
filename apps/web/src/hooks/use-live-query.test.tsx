import {
	focusManager,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getLiveQueryInterval,
	LIVE_QUERY_INTERVAL_IN_MS,
	LIVE_QUERY_MAX_INTERVAL_IN_MS,
	useLiveQuery,
} from "./use-live-query";

const SECOND_IN_MS = 1000;
const BEFORE_INTERVAL_IN_MS = 50;

function renderLiveQuery(queryFn: () => Promise<string>) {
	const queryClient = new QueryClient();
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);

	const hook = renderHook(
		() =>
			useLiveQuery({
				queryKey: ["live-query-test"],
				queryFn,
				serverData: "dados do servidor",
			}),
		{ wrapper }
	);

	return { ...hook, queryClient };
}

/** Advances to just before `ms`, checks no poll happened, then reaches it. */
async function expectNextPollAfter(
	queryFn: ReturnType<typeof vi.fn>,
	ms: number
) {
	const callsBefore = queryFn.mock.calls.length;

	await act(() => vi.advanceTimersByTimeAsync(ms - BEFORE_INTERVAL_IN_MS));
	expect(queryFn).toHaveBeenCalledTimes(callsBefore);

	await act(() => vi.advanceTimersByTimeAsync(BEFORE_INTERVAL_IN_MS));
	expect(queryFn).toHaveBeenCalledTimes(callsBefore + 1);

	// TanStack Query batches observer notifications on a 0ms timer; let the
	// settled fetch propagate to React state.
	await act(() => vi.advanceTimersByTimeAsync(1));
}

describe("getLiveQueryInterval", () => {
	it("dobra o intervalo a cada erro consecutivo até o máximo de 60s", () => {
		expect([0, 1, 2, 3, 4, 5, 10].map(getLiveQueryInterval)).toEqual([
			5 * SECOND_IN_MS,
			10 * SECOND_IN_MS,
			20 * SECOND_IN_MS,
			40 * SECOND_IN_MS,
			LIVE_QUERY_MAX_INTERVAL_IN_MS,
			LIVE_QUERY_MAX_INTERVAL_IN_MS,
			LIVE_QUERY_MAX_INTERVAL_IN_MS,
		]);
	});
});

describe("useLiveQuery", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		focusManager.setFocused(true);
	});

	afterEach(() => {
		vi.useRealTimers();
		focusManager.setFocused(undefined);
	});

	it("aumenta o intervalo após erros consecutivos e volta ao normal após sucesso", async () => {
		const queryFn = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error("offline"))
			.mockRejectedValueOnce(new Error("offline"))
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue("dados novos");

		const { result, unmount } = renderLiveQuery(queryFn);

		expect(result.current).toEqual({
			data: "dados do servidor",
			isOffline: false,
		});

		// 1º poll no intervalo normal → falha
		await expectNextPollAfter(queryFn, LIVE_QUERY_INTERVAL_IN_MS);
		expect(result.current).toEqual({
			data: "dados do servidor",
			isOffline: true,
		});

		// 2º e 3º polls com backoff (10s, 20s) → falham, dados continuam na tela
		await expectNextPollAfter(queryFn, 10 * SECOND_IN_MS);
		await expectNextPollAfter(queryFn, 20 * SECOND_IN_MS);
		expect(result.current).toEqual({
			data: "dados do servidor",
			isOffline: true,
		});

		// 4º poll depois de 40s → volta a funcionar
		await expectNextPollAfter(queryFn, 40 * SECOND_IN_MS);
		expect(result.current).toEqual({ data: "dados novos", isOffline: false });

		// Depois do sucesso, volta ao intervalo normal
		await expectNextPollAfter(queryFn, LIVE_QUERY_INTERVAL_IN_MS);
		await expectNextPollAfter(queryFn, LIVE_QUERY_INTERVAL_IN_MS);

		unmount();
	});

	it("não passa de 60s mesmo com muitos erros seguidos", async () => {
		const queryFn = vi
			.fn<() => Promise<string>>()
			.mockRejectedValue(new Error("offline"));

		const { unmount } = renderLiveQuery(queryFn);

		for (const seconds of [5, 10, 20, 40, 60, 60]) {
			await expectNextPollAfter(queryFn, seconds * SECOND_IN_MS);
		}

		unmount();
	});

	it("pausa enquanto a aba está oculta", async () => {
		const queryFn = vi.fn<() => Promise<string>>().mockResolvedValue("ok");
		const { unmount } = renderLiveQuery(queryFn);

		act(() => focusManager.setFocused(false));
		await act(() => vi.advanceTimersByTimeAsync(LIVE_QUERY_INTERVAL_IN_MS * 4));
		expect(queryFn).not.toHaveBeenCalled();

		unmount();
	});

	it("não sobrepõe requisições enquanto uma ainda está em andamento", async () => {
		let resolveSlowRequest: (value: string) => void = () => undefined;
		const queryFn = vi.fn<() => Promise<string>>().mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveSlowRequest = resolve;
				})
		);

		const { unmount } = renderLiveQuery(queryFn);

		await act(() => vi.advanceTimersByTimeAsync(LIVE_QUERY_INTERVAL_IN_MS * 4));
		expect(queryFn).toHaveBeenCalledTimes(1);

		await act(async () => {
			resolveSlowRequest("ok");
			await vi.advanceTimersByTimeAsync(0);
		});

		unmount();
	});

	it("para de consultar depois de desmontar", async () => {
		const queryFn = vi.fn<() => Promise<string>>().mockResolvedValue("ok");
		const { unmount } = renderLiveQuery(queryFn);

		await expectNextPollAfter(queryFn, LIVE_QUERY_INTERVAL_IN_MS);
		unmount();

		await act(() => vi.advanceTimersByTimeAsync(LIVE_QUERY_INTERVAL_IN_MS * 4));
		expect(queryFn).toHaveBeenCalledTimes(1);
	});
});
