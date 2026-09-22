import { RocketseatIcon } from "@/components/icons/rocketseat-icon";

export default function InviteLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<div
			className="dark flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground"
			data-theme-shell
		>
			<div className="w-full max-w-sm">
				<div className="mb-10 flex flex-col items-center gap-4">
					<RocketseatIcon className="size-10 dark:invert" />

					<span className="flex items-center gap-2 font-poppins font-semibold text-3xl tracking-wide">
						ServiFast
					</span>
				</div>

				<div className="rounded-xl border border-border bg-card p-6 shadow-black/20 shadow-lg">
					{children}
				</div>
			</div>
		</div>
	);
}
