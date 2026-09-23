import { ability } from "@/providers/auth-provider";
import { BillingDetails } from "./~components/billing-details";
import { CreateExpenseSheet } from "./~components/create-expense-sheet";

export default async function RestaurantBillingPage() {
	const permissions = await ability();

	const canGetBillingDetails = permissions?.can("get", "Billing");
	const canCreateExpense = permissions?.can("create", "Billing");

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="font-semibold text-2xl">Financeiro</h1>

				{canCreateExpense && <CreateExpenseSheet />}
			</div>

			<div className="space-y-4">
				{canGetBillingDetails && <BillingDetails />}
			</div>
		</div>
	);
}
