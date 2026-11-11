import { describe, expect, it } from "vitest";
import type { KdsItem } from "@/api/http/services/get-kds-items";
import {
	applyKdsDelta,
	formatElapsed,
	getElapsedSeconds,
	getKdsUrgency,
	groupKdsItemsByOrder,
	isRemovedFromQueue,
} from "./kds-queue";

const NOW = Date.parse("2026-10-29T12:00:00.000Z");
const MINUTE_IN_MS = 60_000;

function minutesAgo(minutes: number) {
	return new Date(NOW - minutes * MINUTE_IN_MS).toISOString();
}

let nextId = 0;

function makeItem(overrides: Partial<KdsItem> = {}): KdsItem {
	nextId += 1;
	return {
		id: `item-${nextId}`,
		productId: `product-${nextId}`,
		productName: `Prato ${nextId}`,
		quantity: 1,
		notes: null,
		sentToKitchenAt: minutesAgo(10),
		status: "RECEIVED",
		tabClosedAt: null,
		tabId: "tab-1",
		table: { number: 1, positionReference: null },
		...overrides,
	};
}

describe("isRemovedFromQueue", () => {
	it("considera removidos os itens prontos, cancelados e os de comanda fechada", () => {
		expect(isRemovedFromQueue(makeItem())).toBe(false);
		expect(isRemovedFromQueue(makeItem({ status: "PREPARING" }))).toBe(false);
		expect(isRemovedFromQueue(makeItem({ status: "READY" }))).toBe(true);
		expect(isRemovedFromQueue(makeItem({ status: "DELIVERED" }))).toBe(true);
		expect(isRemovedFromQueue(makeItem({ status: "CANCELLED" }))).toBe(true);
		expect(isRemovedFromQueue(makeItem({ tabClosedAt: minutesAgo(1) }))).toBe(
			true
		);
	});
});

describe("applyKdsDelta", () => {
	it("adiciona itens novos, atualiza os existentes e mantém os não alterados", () => {
		const kept = makeItem({ sentToKitchenAt: minutesAgo(20) });
		const updated = makeItem({ sentToKitchenAt: minutesAgo(10), quantity: 1 });
		const added = makeItem({ sentToKitchenAt: minutesAgo(1) });

		const result = applyKdsDelta(
			[kept, updated],
			[{ ...updated, quantity: 3 }, added]
		);

		expect(result.map((item) => [item.id, item.quantity])).toEqual([
			[kept.id, 1],
			[updated.id, 3],
			[added.id, 1],
		]);
	});

	it("remove itens cancelados e itens de comandas fechadas", () => {
		const cancelled = makeItem();
		const fromClosedTab = makeItem({ tabId: "tab-2" });
		const stays = makeItem({ tabId: "tab-3" });

		const result = applyKdsDelta(
			[cancelled, fromClosedTab, stays],
			[
				{ ...cancelled, status: "CANCELLED" },
				{ ...fromClosedTab, tabClosedAt: minutesAgo(1) },
			]
		);

		expect(result.map((item) => item.id)).toEqual([stays.id]);
	});

	it("ignora remoções de itens que já não estavam na tela", () => {
		const onScreen = makeItem();
		const unknownCancelled = makeItem({ status: "CANCELLED" });

		expect(applyKdsDelta([onScreen], [unknownCancelled])).toEqual([onScreen]);
	});

	it("mantém a fila ordenada pelo envio, do mais antigo para o mais novo", () => {
		const newer = makeItem({ sentToKitchenAt: minutesAgo(2) });
		const older = makeItem({ sentToKitchenAt: minutesAgo(30) });

		expect(applyKdsDelta([newer], [older]).map((item) => item.id)).toEqual([
			older.id,
			newer.id,
		]);
	});
});

describe("groupKdsItemsByOrder", () => {
	it("cria um pedido por envio e ordena pela chegada (FIFO)", () => {
		const table5FirstSent = minutesAgo(25);
		const table5First = makeItem({
			tabId: "tab-5",
			table: { number: 5, positionReference: "Varanda" },
			sentToKitchenAt: table5FirstSent,
		});
		const table5FirstOther = makeItem({
			tabId: "tab-5",
			table: { number: 5, positionReference: "Varanda" },
			sentToKitchenAt: table5FirstSent,
		});
		const table2 = makeItem({
			tabId: "tab-2",
			table: { number: 2, positionReference: null },
			sentToKitchenAt: minutesAgo(12),
		});
		const table5SecondRound = makeItem({
			tabId: "tab-5",
			table: { number: 5, positionReference: "Varanda" },
			sentToKitchenAt: minutesAgo(3),
		});

		const tickets = groupKdsItemsByOrder([
			table5SecondRound,
			table2,
			table5First,
			table5FirstOther,
		]);

		expect(
			tickets.map((ticket) => ({
				table: ticket.table.number,
				sentAt: ticket.sentAt,
				items: ticket.items.map((item) => item.id),
			}))
		).toEqual([
			{
				table: 5,
				sentAt: table5FirstSent,
				items: [table5First.id, table5FirstOther.id],
			},
			{ table: 2, sentAt: table2.sentToKitchenAt, items: [table2.id] },
			{
				table: 5,
				sentAt: table5SecondRound.sentToKitchenAt,
				items: [table5SecondRound.id],
			},
		]);
	});

	it("retorna lista vazia quando a fila está vazia", () => {
		expect(groupKdsItemsByOrder([])).toEqual([]);
	});
});

describe("cronômetro e urgência", () => {
	it("calcula os segundos decorridos (nunca negativo)", () => {
		expect(getElapsedSeconds(minutesAgo(12), NOW)).toBe(12 * 60);
		expect(
			getElapsedSeconds(new Date(NOW + MINUTE_IN_MS).toISOString(), NOW)
		).toBe(0);
	});

	it("formata como mm:ss e h:mm:ss depois de uma hora", () => {
		expect(formatElapsed(0)).toBe("00:00");
		expect(formatElapsed(65)).toBe("01:05");
		expect(formatElapsed(59 * 60 + 59)).toBe("59:59");
		expect(formatElapsed(3600 + 2 * 60 + 3)).toBe("1:02:03");
	});

	it("verde até 15 min, amarelo a partir de 15 min e vermelho a partir de 25 min", () => {
		const minutes = [0, 14, 15, 24, 25, 60];
		expect(minutes.map((m) => getKdsUrgency(m * 60))).toEqual([
			"normal",
			"normal",
			"warning",
			"warning",
			"late",
			"late",
		]);
		expect(getKdsUrgency(15 * 60 - 1)).toBe("normal");
	});
});
