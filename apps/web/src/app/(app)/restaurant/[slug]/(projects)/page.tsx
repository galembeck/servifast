import { ability } from "@/providers/auth-provider";
import { ProjectsList } from "./~components/projects-list";

export default async function RestaurantProjectsPage() {
	const permissions = await ability();

	return (
		<div className="space-y-4">
			<h1 className="font-semibold text-2xl">Projects</h1>

			{permissions?.can("get", "Project") ? (
				<ProjectsList />
			) : (
				<p className="text-muted-foreground text-sm">
					You are not allowed to see restaurant projects
				</p>
			)}
		</div>
	);
}
