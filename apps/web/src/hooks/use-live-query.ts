"use client";

import { type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export const LIVE_QUERY_INTERVAL_IN_MS = 5000;
export const LIVE_QUERY_MAX_INTERVAL_IN_MS = 60_000;

/**
 * Exponential backoff: 5s normally, then 10s, 20s, 40s… capped at 60s while
 * polls keep failing.
 */
export function getLiveQueryInterval(consecutiveErrors: number) {
	return getBackoffInterval(consecutiveErrors, LIVE_QUERY_INTERVAL_IN_MS);
}

/** Same backoff from a custom base interval (never capped below the base). */
export function getBackoffInterval(
	consecutiveErrors: number,
	baseIntervalInMs: number
) {
	return Math.min(
		baseIntervalInMs * 2 ** consecutiveErrors,
		Math.max(LIVE_QUERY_MAX_INTERVAL_IN_MS, baseIntervalInMs)
	);
}

interface UseLiveQueryOptions<T> {
	enabled?: boolean;
	/** Polling interval while healthy (default 5s). */
	intervalInMs?: number;
	queryFn: () => Promise<T>;
	queryKey: QueryKey;
	serverData: T;
}

/**
 * Polls data for screens that must reflect changes made by other staff
 * (floor/tables, tabs, KDS) without a manual reload.
 *
 * - Starts from the data rendered by the Server Component and re-syncs
 *   whenever the server re-renders (e.g. after a Server Action).
 * - No overlapping requests: TanStack Query doesn't start an interval refetch
 *   while the previous fetch for the same key is still in flight.
 * - Pauses while the browser tab is hidden (`refetchIntervalInBackground`).
 * - Cleans up on unmount: the query observer clears its interval when the
 *   component unmounts — no manual timers here.
 * - Backs off on errors (see `getLiveQueryInterval`) and returns to the normal
 *   interval after the next success, keeping the last known data on screen.
 */
export function useLiveQuery<T>({
	enabled = true,
	intervalInMs = LIVE_QUERY_INTERVAL_IN_MS,
	queryFn,
	queryKey,
	serverData,
}: UseLiveQueryOptions<T>) {
	const queryClient = useQueryClient();
	const serializedKey = JSON.stringify(queryKey);
	const consecutiveErrors = useRef(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is tracked through serializedKey
	useEffect(() => {
		queryClient.setQueryData(queryKey, serverData);
	}, [queryClient, serializedKey, serverData]);

	const query = useQuery({
		queryKey,
		queryFn: async () => {
			try {
				const data = await queryFn();
				consecutiveErrors.current = 0;
				return data;
			} catch (error) {
				consecutiveErrors.current += 1;
				throw error;
			}
		},
		initialData: serverData,
		enabled,
		staleTime: intervalInMs,
		refetchInterval: enabled
			? () => getBackoffInterval(consecutiveErrors.current, intervalInMs)
			: false,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: true,
		retry: false,
	});

	return {
		data: query.data ?? serverData,
		isOffline: query.isError,
	};
}
