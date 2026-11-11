import type { KdsItem } from "@/api/http/services/get-kds-items";

const SECOND_IN_MS = 1000;
const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;

/** Minutes after which an order turns yellow (warning) and red (late). */
export const KDS_WARNING_AFTER_MINUTES = 15;
export const KDS_LATE_AFTER_MINUTES = 25;

export type KdsUrgency = "normal" | "warning" | "late";

/**
 * One kitchen order: the items a tab sent to the kitchen in a single
 * "send to kitchen" action. They all share the same `sentToKitchenAt`.
 */
export interface KdsTicket {
	id: string;
	items: KdsItem[];
	sentAt: string;
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

/**
 * One ticket per order (tab + send time), in FIFO order: a second round from
 * the same table goes to the end of the queue instead of jumping ahead.
 */
export function groupKdsItemsByOrder(items: KdsItem[]): KdsTicket[] {
	const ticketsById = new Map<string, KdsTicket>();

	for (const item of [...items].sort(bySentToKitchenAt)) {
		const id = `${item.tabId}:${item.sentToKitchenAt}`;
		const ticket = ticketsById.get(id);

		if (ticket) {
			ticket.items.push(item);
			continue;
		}

		ticketsById.set(id, {
			id,
			tabId: item.tabId,
			table: item.table,
			sentAt: item.sentToKitchenAt,
			items: [item],
		});
	}

	return [...ticketsById.values()];
}

export function getElapsedSeconds(sentAt: string, now: number) {
	return Math.max(0, Math.floor((now - Date.parse(sentAt)) / SECOND_IN_MS));
}

/** `mm:ss`, or `h:mm:ss` after one hour. */
export function formatElapsed(totalSeconds: number) {
	const seconds = totalSeconds % SECONDS_IN_MINUTE;
	const totalMinutes = Math.floor(totalSeconds / SECONDS_IN_MINUTE);
	const minutes = totalMinutes % MINUTES_IN_HOUR;
	const hours = Math.floor(totalMinutes / MINUTES_IN_HOUR);

	const ss = String(seconds).padStart(2, "0");

	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
	}

	return `${String(totalMinutes).padStart(2, "0")}:${ss}`;
}

export function getKdsUrgency(elapsedSeconds: number): KdsUrgency {
	const minutes = elapsedSeconds / SECONDS_IN_MINUTE;

	if (minutes >= KDS_LATE_AFTER_MINUTES) {
		return "late";
	}
	if (minutes >= KDS_WARNING_AFTER_MINUTES) {
		return "warning";
	}
	return "normal";
}
