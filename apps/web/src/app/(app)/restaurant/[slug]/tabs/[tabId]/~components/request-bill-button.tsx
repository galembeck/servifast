"use client";

import { HandCoins, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestBillAction } from "../~actions/actions";

interface RequestBillButtonProps {
	tabId: string;
}

export function RequestBillButton({ tabId }: RequestBillButtonProps) {
	const [isPending, startTransition] = useTransition();

	function handleRequestBill() {
		startTransition(async () => {
			const result = await requestBillAction(tabId);
			if (result.success) {
				toast.success(result.title, {
					description: "A mesa aparece como “Conta” para o caixa.",
				});
			} else {
				toast.error(result.title);
			}
		});
	}

	return (
		<Button
			disabled={isPending}
			onClick={handleRequestBill}
			type="button"
			variant="outline"
		>
			{isPending ? (
				<Loader2 className="mr-2 size-4 animate-spin" />
			) : (
				<HandCoins className="mr-2 size-4" />
			)}
			Pedir conta
		</Button>
	);
}
