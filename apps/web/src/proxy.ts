import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	const response = NextResponse.next();

	if (pathname.startsWith("/restaurant")) {
		const [, , slug] = pathname.split("/");

		if (slug) {
			response.cookies.set("restaurant", slug);
		}
	} else if (!request.headers.get("Next-Router-Prefetch")) {
		response.cookies.delete("restaurant");
	}

	return response;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico).*)",
	],
};
