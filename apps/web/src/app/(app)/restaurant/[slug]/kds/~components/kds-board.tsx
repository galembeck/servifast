"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChefHat } from "lucide-react";
import { useEffect, useState } from "react";
import {
	type GetKdsItemsResponse,
	getKdsItems,
} from "@/api/http/services/get-kds-items";
import { OfflineIndicator } from "@/components/offline-indicator";
import { useLiveQuery } from "@/hooks/use-live-query";
import { applyKdsDelta, groupKdsItemsByTab } from "@/lib/kds-queue";
import { KdsTicketCard } from "./kds-ticket-card";

const CLOCK_TICK_IN_MS = 30_000;

/**
 * Current time, only on the client: waiting times depend on the viewer's
 * clock, so rendering them on the server would cause hydration mismatches.
 */
function useNow() {
	const [now, setNow] = useState<number | null>(null);

	useEffect(() => {
		setNow(Date.now());
		const intervalId = setInterval(() => setNow(Date.now()), CLOCK_TICK_IN_MS);
		return () => clearInterval(intervalId);
	}, []);

	return now;
}

interface KdsBoardProps {
	currentRestaurant: string;
	queue: GetKdsItemsResponse;
}

export function KdsBoard({ currentRestaurant, queue }: KdsBoardProps) {
	const queryClient = useQueryClient();
	const queryKey = ["restaurants", currentRestaurant, "kds"];
	const now = useNow();

	const { data, isOffline } = useLiveQuery({
		queryKey,
		// Incremental poll: only fetch what changed since the last read and
		// apply it on top of the queue already on screen.
		queryFn: async () => {
			const previous =
				queryClient.getQueryData<GetKdsItemsResponse>(queryKey) ?? queue;
			const delta = await getKdsItems(currentRestaurant, previous.serverTime);

			return {
				items: applyKdsDelta(previous.items, delta.items),
				serverTime: delta.serverTime,
			};
		},
		serverData: queue,
	});

	const tickets = groupKdsItemsByTab(data.items);
	const itemsCount = data.items.reduce((sum, item) => sum + item.quantity, 0);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="font-semibold text-2xl">Cozinha</h1>
					<p className="text-muted-foreground text-sm">
						{tickets.length} {tickets.length === 1 ? "mesa" : "mesas"} ·{" "}
						{itemsCount} {itemsCount === 1 ? "item" : "itens"} na fila
					</p>
				</div>

				{isOffline && <OfflineIndicator />}
			</div>

			{tickets.length === 0 ? (
				<div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-muted-foreground">
					<ChefHat className="size-8" />
					<p className="text-sm">Nenhum pedido na fila no momento.</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{tickets.map((ticket) => (
						<KdsTicketCard key={ticket.tabId} now={now} ticket={ticket} />
					))}
				</div>
			)}
		</div>
	);
}
