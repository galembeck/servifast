import { type ReactNode, Suspense } from "react";
import { ability } from "@/providers/auth-provider";
import { DashboardNav } from "./~components/dashboard-nav";

export default async function RestaurantDashboardLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const permissions = await ability();

	// Pages render their own "no permission" message.
	if (!permissions?.can("get", "Report")) {
		return children;
	}

	return (
		<div className="space-y-6">
			<h1 className="font-semibold text-2xl">Dashboard</h1>

			<Suspense>
				<DashboardNav slug={slug} />
			</Suspense>

			{children}
		</div>
	);
}
