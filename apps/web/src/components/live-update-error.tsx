import { WifiOff } from "lucide-react";

export function LiveUpdateError() {
	return (
		<p
			className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-600 text-sm dark:text-amber-400"
			role="status"
		>
			<WifiOff className="size-4 shrink-0" />
			Não foi possível atualizar agora. Mostrando os últimos dados recebidos;
			tentando novamente…
		</p>
	);
}
