"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBillSplit } from "@/api/http/services/bill-split";
import type { TabItem } from "@/api/http/services/get-tab";
import { Button } from "@/components/ui/button";
import { formatPrice } from "../../../dashboard/~components/format";
import { CloseTabDialog } from "./close-tab-dialog";

export function PartialPaymentPanel({
	restaurant,
	tabId,
	items,
}: {
	restaurant: string;
	tabId: string;
	items: TabItem[];
}) {
	const client = useQueryClient();
	const query = useQuery({
		queryKey: ["bill-split", restaurant, tabId],
		queryFn: () => getBillSplit(restaurant, tabId),
		refetchInterval: 5000,
	});
	if (query.isError) {
		return (
			<div role="alert">
				Não foi possível consultar o saldo.{" "}
				<Button onClick={() => query.refetch()} variant="outline">
					Tentar novamente
				</Button>
			</div>
		);
	}
	const state = query.data?.split;
	if (!state) {
		return <p role="status">Consultando saldo…</p>;
	}
	return (
		<section
			aria-label="Saldo da comanda"
			className="space-y-3 rounded-md border p-4"
		>
			<h2 className="font-semibold">Pagamento parcial</h2>
			<dl aria-live="polite" className="flex flex-wrap gap-6">
				<div>
					<dt>Total ajustado</dt>
					<dd>{formatPrice(state.amountInCents)}</dd>
				</div>
				<div>
					<dt>Total pago</dt>
					<dd>{formatPrice(state.paidInCents)}</dd>
				</div>
				<div>
					<dt>Saldo restante</dt>
					<dd className="font-semibold text-xl">
						{formatPrice(state.remainingInCents)}
					</dd>
				</div>
			</dl>
			{state.closedAt ? (
				<p>Conta liquidada. Mesa liberada.</p>
			) : (
				<>
					<p className="text-muted-foreground text-sm">
						Itens, taxa e desconto fixados pelo primeiro pagamento. A mesa
						permanece ocupada até quitar o saldo.
					</p>
					<CloseTabDialog
						checkout={state}
						items={items}
						onPayment={(next) =>
							client.setQueryData(["bill-split", restaurant, tabId], {
								split: next,
							})
						}
						restaurant={restaurant}
						tabId={tabId}
					/>
				</>
			)}
		</section>
	);
}
