import type { KdsItem } from "@/api/http/services/get-kds-items";

const MINUTE_IN_MS = 60_000;

/** Minutes after which a ticket is highlighted as waiting too long. */
export const KDS_WARNING_AFTER_MINUTES = 15;
export const KDS_LATE_AFTER_MINUTES = 25;

export type KdsUrgency = "normal" | "warning" | "late";

export interface KdsTicket {
	items: KdsItem[];
	oldestSentAt: string;
	tabId: string;
	table: KdsItem["table"];
}

/**
 * An incremental (`since`) read also returns items that left the queue:
 * cancelled ones and those whose tab was closed.
 */
export function isRemovedFromQueue(item: KdsItem) {
	return item.status === "CANCELLED" || item.tabClosedAt !== null;
}

function bySentToKitchenAt(a: KdsItem, b: KdsItem) {
	return Date.parse(a.sentToKitchenAt) - Date.parse(b.sentToKitchenAt);
}

/** Applies an incremental read on top of the queue currently on screen. */
export function applyKdsDelta(current: KdsItem[], delta: KdsItem[]) {
	const itemsById = new Map(current.map((item) => [item.id, item]));

	for (const item of delta) {
		if (isRemovedFromQueue(item)) {
			itemsById.delete(item.id);
		} else {
			itemsById.set(item.id, item);
		}
	}

	return [...itemsById.values()].sort(bySentToKitchenAt);
}

/** One ticket per tab, oldest ticket first; items keep send order. */
export function groupKdsItemsByTab(items: KdsItem[]): KdsTicket[] {
	const ticketsByTab = new Map<string, KdsTicket>();

	for (const item of [...items].sort(bySentToKitchenAt)) {
		const ticket = ticketsByTab.get(item.tabId);

		if (ticket) {
			ticket.items.push(item);
			continue;
		}

		ticketsByTab.set(item.tabId, {
			tabId: item.tabId,
			table: item.table,
			oldestSentAt: item.sentToKitchenAt,
			items: [item],
		});
	}

	return [...ticketsByTab.values()].sort(
		(a, b) => Date.parse(a.oldestSentAt) - Date.parse(b.oldestSentAt)
	);
}

export function getWaitingMinutes(sentAt: string, now: number) {
	return Math.max(0, Math.floor((now - Date.parse(sentAt)) / MINUTE_IN_MS));
}

export function getKdsUrgency(waitingMinutes: number): KdsUrgency {
	if (waitingMinutes >= KDS_LATE_AFTER_MINUTES) {
		return "late";
	}
	if (waitingMinutes >= KDS_WARNING_AFTER_MINUTES) {
		return "warning";
	}
	return "normal";
}
