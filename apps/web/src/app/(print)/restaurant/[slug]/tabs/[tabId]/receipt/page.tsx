import { HTTPError } from "ky";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTabReceipt } from "@/api/http/services/get-tab-receipt";
import { isAuthenticated } from "@/providers/auth-provider";
import { ReceiptView } from "./~components/receipt-view";

export const metadata: Metadata = {
	title: "Comprovante | ServiFast",
};

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

const ERROR_MESSAGES: Record<number, string> = {
	[HTTP_CONFLICT]:
		"Esta conta ainda não foi finalizada. O comprovante fica disponível depois do pagamento.",
	[HTTP_FORBIDDEN]: "Você não tem permissão para emitir comprovantes.",
};

export default async function ReceiptPage({
	params,
}: {
	params: Promise<{ slug: string; tabId: string }>;
}) {
	if (!(await isAuthenticated())) {
		redirect("/auth/sign-in");
	}

	const { slug, tabId } = await params;

	const result = await getTabReceipt(slug, tabId)
		.then((receipt) => ({ receipt, status: null }))
		.catch((error: unknown) => {
			if (error instanceof HTTPError) {
				return { receipt: null, status: error.response.status };
			}
			throw error;
		});

	if (result.status === HTTP_NOT_FOUND) {
		notFound();
	}

	if (!result.receipt) {
		return (
			<main className="flex flex-1 items-center justify-center p-6">
				<p className="max-w-sm text-center text-muted-foreground text-sm">
					{(result.status && ERROR_MESSAGES[result.status]) ||
						"Não foi possível carregar o comprovante."}
				</p>
			</main>
		);
	}

	return <ReceiptView receipt={result.receipt} />;
}
