import { Check, Flame, Loader2, Timer } from "lucide-react";
import type { KitchenTargetStatus } from "@/api/http/services/update-kds-item-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
	formatElapsed,
	getElapsedSeconds,
	getKdsUrgency,
	type KdsTicket,
	type KdsUrgency,
} from "@/lib/kds-queue";

const URGENCY_STYLES: Record<
	KdsUrgency,
	{ card: string; timer: string; label: string }
> = {
	normal: {
		card: "border-t-8 border-t-emerald-500",
		timer: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
		label: "No prazo",
	},
	warning: {
		card: "border-t-8 border-t-amber-500",
		timer: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
		label: "Atenção",
	},
	late: {
		card: "border-t-8 border-t-red-500",
		timer: "bg-red-500/15 text-red-700 dark:text-red-400",
		label: "Atrasado",
	},
};

const sentAtFormatter = new Intl.DateTimeFormat("pt-BR", {
	hour: "2-digit",
	minute: "2-digit",
});

interface KdsTicketCardProps {
	canUpdateStatus: boolean;
	now: number | null;
	onUpdateStatus: (itemId: string, status: KitchenTargetStatus) => void;
	pendingItemId: string | undefined;
	position: number;
	ticket: KdsTicket;
}

export function KdsTicketCard({
	canUpdateStatus,
	now,
	onUpdateStatus,
	pendingItemId,
	position,
	ticket,
}: KdsTicketCardProps) {
	const elapsedSeconds =
		now === null ? null : getElapsedSeconds(ticket.sentAt, now);
	const urgency =
		elapsedSeconds === null ? "normal" : getKdsUrgency(elapsedSeconds);
	const styles = URGENCY_STYLES[urgency];

	return (
		<Card
			aria-label={`Pedido ${position} da fila, mesa ${ticket.table.number}`}
			className={styles.card}
		>
			<CardHeader className="flex-row items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="font-medium text-muted-foreground text-sm">
						#{position} na fila
					</p>
					<p className="font-bold text-3xl">Mesa {ticket.table.number}</p>
					<p className="text-muted-foreground text-sm">
						{ticket.table.positionReference
							? `${ticket.table.positionReference} · `
							: ""}
						enviado às {sentAtFormatter.format(new Date(ticket.sentAt))}
					</p>
				</div>

				{elapsedSeconds !== null && (
					<div
						className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-2 ${styles.timer}`}
						title="Tempo desde que o pedido chegou na cozinha"
					>
						<span className="inline-flex items-center gap-1 font-bold text-2xl tabular-nums">
							<Timer className="size-5" />
							{formatElapsed(elapsedSeconds)}
						</span>
						<span className="font-medium text-xs uppercase">
							{styles.label}
						</span>
					</div>
				)}
			</CardHeader>

			<CardContent>
				<ul className="divide-y">
					{ticket.items.map((item) => {
						const isPreparing = item.status === "PREPARING";
						const isPending = pendingItemId === item.id;

						return (
							<li className="space-y-2 py-3 text-lg" key={item.id}>
								<div className="flex gap-3">
									<span className="min-w-10 font-bold tabular-nums">
										{item.quantity}×
									</span>
									<div className="min-w-0 flex-1">
										<p className="font-semibold">{item.productName}</p>
										{item.notes && (
											<p className="font-semibold text-amber-700 text-base dark:text-amber-400">
												⚠ {item.notes}
											</p>
										)}
									</div>
									<Badge
										className="shrink-0 self-start"
										variant={isPreparing ? "default" : "secondary"}
									>
										{isPreparing ? "Em preparo" : "Recebido"}
									</Badge>
								</div>

								{canUpdateStatus && (
									<Button
										className="h-12 w-full text-base"
										disabled={isPending}
										onClick={() =>
											onUpdateStatus(
												item.id,
												isPreparing ? "READY" : "PREPARING"
											)
										}
										type="button"
										variant={isPreparing ? "default" : "outline"}
									>
										{isPending && <Loader2 className="size-5 animate-spin" />}
										{!isPending && isPreparing && <Check className="size-5" />}
										{!(isPending || isPreparing) && (
											<Flame className="size-5" />
										)}
										{isPreparing ? "Concluir" : "Iniciar preparo"}
									</Button>
								)}
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
