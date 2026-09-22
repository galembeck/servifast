import { redirect } from "next/navigation";
import { isAuthenticated } from "@/providers/auth-provider";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	if (await isAuthenticated()) {
		redirect("/");
	}

	return (
		<div className="auth-theme flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
			<div className="w-full max-w-sm">
				<div className="mb-10 flex flex-col items-center gap-2">
					<span className="flex items-center gap-2 font-poppins font-semibold text-3xl tracking-wide">
						ServiFast
					</span>

					<p className="text-center text-muted-foreground text-sm">
						Operações eficientes e controle total para seu negócio, a um clique
						de distância.
					</p>
				</div>

				<div className="rounded-xl border border-border bg-card p-6 shadow-black/20 shadow-lg">
					{children}
				</div>
			</div>
		</div>
	);
}
