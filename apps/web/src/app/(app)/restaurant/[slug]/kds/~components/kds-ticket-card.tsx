import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
	getKdsUrgency,
	getWaitingMinutes,
	type KdsTicket,
	type KdsUrgency,
} from "@/lib/kds-queue";

const URGENCY_STYLES: Record<KdsUrgency, { badge: string; card: string }> = {
	normal: {
		card: "",
		badge: "bg-muted text-muted-foreground",
	},
	warning: {
		card: "border-amber-500/60",
		badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
	},
	late: {
		card: "border-red-500/70",
		badge: "bg-red-500/15 text-red-600 dark:text-red-400",
	},
};

function formatWaiting(minutes: number) {
	return minutes < 1 ? "agora" : `${minutes} min`;
}

interface KdsTicketCardProps {
	now: number | null;
	ticket: KdsTicket;
}

export function KdsTicketCard({ now, ticket }: KdsTicketCardProps) {
	const waitingMinutes =
		now === null ? null : getWaitingMinutes(ticket.oldestSentAt, now);
	const urgency =
		waitingMinutes === null ? "normal" : getKdsUrgency(waitingMinutes);
	const styles = URGENCY_STYLES[urgency];

	return (
		<Card className={styles.card}>
			<CardHeader className="flex-row items-start justify-between gap-2">
				<div>
					<p className="font-semibold text-xl">Mesa {ticket.table.number}</p>
					{ticket.table.positionReference && (
						<p className="text-muted-foreground text-xs">
							{ticket.table.positionReference}
						</p>
					)}
				</div>

				{waitingMinutes !== null && (
					<span
						className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${styles.badge}`}
						title="Tempo desde o envio mais antigo desta mesa"
					>
						<Clock className="size-3" />
						{formatWaiting(waitingMinutes)}
					</span>
				)}
			</CardHeader>

			<CardContent>
				<ul className="space-y-2">
					{ticket.items.map((item) => (
						<li className="flex gap-2" key={item.id}>
							<span className="min-w-8 font-semibold tabular-nums">
								{item.quantity}×
							</span>
							<div className="min-w-0">
								<p className="font-medium">{item.productName}</p>
								{item.notes && (
									<p className="font-medium text-amber-600 text-sm dark:text-amber-400">
										{item.notes}
									</p>
								)}
							</div>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
