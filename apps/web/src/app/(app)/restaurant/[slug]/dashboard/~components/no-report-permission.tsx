export function NoReportPermission() {
	return (
		<div className="space-y-4">
			<h1 className="font-semibold text-2xl">Dashboard</h1>
			<p className="text-muted-foreground text-sm">
				Você não tem permissão para ver os relatórios deste restaurante.
			</p>
		</div>
	);
}
