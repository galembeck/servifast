import { redirect } from "next/navigation";
import { isAuthenticated } from "@/providers/auth-provider";

export default async function AppLayout({
	children,
	sheet,
}: Readonly<{
	children: React.ReactNode;
	sheet: React.ReactNode;
}>) {
	if (!(await isAuthenticated())) {
		redirect("/auth/sign-in");
	}

	return (
		<>
			{children}
			{sheet}
		</>
	);
}
