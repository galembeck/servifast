"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChefHat } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	type GetKdsItemsResponse,
	getKdsItems,
} from "@/api/http/services/get-kds-items";
import type { KitchenTargetStatus } from "@/api/http/services/update-kds-item-status";
import { OfflineIndicator } from "@/components/offline-indicator";
import { useLiveQuery } from "@/hooks/use-live-query";
import { applyKdsDelta, groupKdsItemsByOrder } from "@/lib/kds-queue";
import { updateKdsItemStatusAction } from "../~actions/actions";
import { KdsTicketCard } from "./kds-ticket-card";

const CLOCK_TICK_IN_MS = 1000;

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
	canUpdateStatus: boolean;
	currentRestaurant: string;
	queue: GetKdsItemsResponse;
}

export function KdsBoard({
	canUpdateStatus,
	currentRestaurant,
	queue,
}: KdsBoardProps) {
	const queryClient = useQueryClient();
	const queryKey = ["restaurants", currentRestaurant, "kds"];
	const now = useNow();

	const updateStatus = useMutation({
		// Goes through a Server Action, like the app's other mutations: the API's
		// CORS policy doesn't allow PATCH straight from the browser.
		mutationFn: async ({
			itemId,
			status,
		}: {
			itemId: string;
			status: KitchenTargetStatus;
		}) => {
			const result = await updateKdsItemStatusAction(itemId, status);

			if (!result.success) {
				throw new Error(
					result.title ?? "Não foi possível atualizar o status do item."
				);
			}

			return result;
		},
		onSuccess: async ({ item }) => {
			// Apply the change right away instead of waiting for the next poll.
			// An in-flight poll could overwrite it with stale data, so cancel it.
			await queryClient.cancelQueries({ queryKey });
			queryClient.setQueryData<GetKdsItemsResponse>(queryKey, (previous) => {
				const current = previous ?? queue;
				const existing = current.items.find((i) => i.id === item.id);

				if (!existing) {
					return current;
				}

				return {
					...current,
					items: applyKdsDelta(current.items, [
						{ ...existing, status: item.status },
					]),
				};
			});

			if (item.status === "READY") {
				toast.success("Item pronto!");
			}
		},
		onError: async (error) => {
			toast.error(error.message);
			// The item may have changed elsewhere: resync with the server.
			await queryClient.invalidateQueries({ queryKey });
		},
	});

	const pendingItemId = updateStatus.isPending
		? updateStatus.variables?.itemId
		: undefined;

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

	const tickets = groupKdsItemsByOrder(data.items);
	const itemsCount = data.items.reduce((sum, item) => sum + item.quantity, 0);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="font-semibold text-2xl">Cozinha</h1>
					<p className="text-muted-foreground">
						{tickets.length} {tickets.length === 1 ? "pedido" : "pedidos"} ·{" "}
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
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
					{tickets.map((ticket, index) => (
						<KdsTicketCard
							canUpdateStatus={canUpdateStatus}
							key={ticket.id}
							now={now}
							onUpdateStatus={(itemId, status) =>
								updateStatus.mutate({ itemId, status })
							}
							pendingItemId={pendingItemId}
							position={index + 1}
							ticket={ticket}
						/>
					))}
				</div>
			)}
		</div>
	);
}
