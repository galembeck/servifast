import { describe, expect, it } from "vitest";
import type { KdsItem } from "@/api/http/services/get-kds-items";
import {
	applyKdsDelta,
	getKdsUrgency,
	getWaitingMinutes,
	groupKdsItemsByTab,
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
	it("considera removidos os itens cancelados e os de comanda fechada", () => {
		expect(isRemovedFromQueue(makeItem())).toBe(false);
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

describe("groupKdsItemsByTab", () => {
	it("agrupa por comanda e ordena as mesas pelo pedido mais antigo", () => {
		const table5Late = makeItem({
			tabId: "tab-5",
			table: { number: 5, positionReference: "Varanda" },
			sentToKitchenAt: minutesAgo(3),
		});
		const table2 = makeItem({
			tabId: "tab-2",
			table: { number: 2, positionReference: null },
			sentToKitchenAt: minutesAgo(12),
		});
		const table5First = makeItem({
			tabId: "tab-5",
			table: { number: 5, positionReference: "Varanda" },
			sentToKitchenAt: minutesAgo(25),
		});

		const tickets = groupKdsItemsByTab([table5Late, table2, table5First]);

		expect(
			tickets.map((ticket) => ({
				table: ticket.table.number,
				oldestSentAt: ticket.oldestSentAt,
				items: ticket.items.map((item) => item.id),
			}))
		).toEqual([
			{
				table: 5,
				oldestSentAt: table5First.sentToKitchenAt,
				items: [table5First.id, table5Late.id],
			},
			{
				table: 2,
				oldestSentAt: table2.sentToKitchenAt,
				items: [table2.id],
			},
		]);
	});

	it("retorna lista vazia quando a fila está vazia", () => {
		expect(groupKdsItemsByTab([])).toEqual([]);
	});
});

describe("tempo de espera e urgência", () => {
	it("calcula os minutos de espera (nunca negativo)", () => {
		expect(getWaitingMinutes(minutesAgo(12), NOW)).toBe(12);
		expect(
			getWaitingMinutes(new Date(NOW + MINUTE_IN_MS).toISOString(), NOW)
		).toBe(0);
	});

	it("fica amarelo a partir de 15 min e vermelho a partir de 25 min", () => {
		expect([0, 14, 15, 24, 25, 60].map(getKdsUrgency)).toEqual([
			"normal",
			"normal",
			"warning",
			"warning",
			"late",
			"late",
		]);
	});
});
