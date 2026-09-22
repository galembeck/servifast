import type { Metadata } from "next";
import "./globals.css";
import { DM_Sans, Inter, Poppins } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const poppins = Poppins({
	subsets: ["latin"],
	variable: "--font-poppins",
	weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
	title: "ServiFast | Restaurant Management System",
	description: "Restaurant management system for waiters, kitchens, and staff.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			className={cn(
				"h-full antialiased",
				"font-sans",
				inter.variable,
				poppins.variable
			)}
			lang="en"
			suppressHydrationWarning
		>
			<body className="flex min-h-full flex-col">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
