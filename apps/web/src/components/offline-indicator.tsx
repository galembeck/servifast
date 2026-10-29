import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
	return (
		<span
			className="inline-flex items-center gap-1.5 text-amber-600 text-xs dark:text-amber-400"
			role="status"
			title="Mostrando os últimos dados recebidos. Tentando reconectar…"
		>
			<WifiOff className="size-3.5 shrink-0" />
			Sem conexão — tentando reconectar
		</span>
	);
}
