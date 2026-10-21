"use client";

import { Loader2, Send } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendToKitchenAction } from "../~actions/actions";

interface SendToKitchenButtonProps {
	pendingCount: number;
	tabId: string;
}

export function SendToKitchenButton({
	pendingCount,
	tabId,
}: SendToKitchenButtonProps) {
	const [isPending, startTransition] = useTransition();

	function handleSend() {
		startTransition(async () => {
			const result = await sendToKitchenAction(tabId);
			if (result.success) {
				toast.success(result.title ?? "Pedido enviado para a cozinha!");
			} else {
				toast.error(result.title ?? "Erro ao enviar pedido.");
			}
		});
	}

	const label =
		pendingCount > 0
			? `Enviar ${pendingCount} ${pendingCount === 1 ? "item" : "itens"}`
			: "Nenhum item pendente";

	return (
		<Button
			disabled={isPending || pendingCount === 0}
			onClick={handleSend}
			type="button"
		>
			{isPending ? (
				<>
					<Loader2 className="mr-2 size-4 animate-spin" />
					Enviando...
				</>
			) : (
				<>
					<Send className="mr-2 size-4" />
					{label}
				</>
			)}
		</Button>
	);
}
