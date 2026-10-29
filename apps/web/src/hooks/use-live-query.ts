"use client";

import { type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export const LIVE_QUERY_INTERVAL_IN_MS = 5000;

interface UseLiveQueryOptions<T> {
	enabled?: boolean;
	queryFn: () => Promise<T>;
	queryKey: QueryKey;
	serverData: T;
}

/**
 * Polls data for screens that must reflect changes made by other staff
 * (floor/tables, tabs) without a manual reload.
 *
 * - Starts from the data rendered by the Server Component.
 * - Re-syncs whenever the server re-renders (e.g. after a Server Action).
 * - Pauses while the browser tab is hidden.
 * - On a failed poll, keeps the last known data on screen (`isError` with
 *   `data` still set) and keeps retrying on the next interval.
 */
export function useLiveQuery<T>({
	enabled = true,
	queryFn,
	queryKey,
	serverData,
}: UseLiveQueryOptions<T>) {
	const queryClient = useQueryClient();
	const serializedKey = JSON.stringify(queryKey);

	// biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is tracked through serializedKey
	useEffect(() => {
		queryClient.setQueryData(queryKey, serverData);
	}, [queryClient, serializedKey, serverData]);

	const query = useQuery({
		queryKey,
		queryFn,
		initialData: serverData,
		enabled,
		staleTime: LIVE_QUERY_INTERVAL_IN_MS,
		refetchInterval: enabled ? LIVE_QUERY_INTERVAL_IN_MS : false,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: true,
		retry: false,
	});

	return { data: query.data ?? serverData, isError: query.isError };
}
