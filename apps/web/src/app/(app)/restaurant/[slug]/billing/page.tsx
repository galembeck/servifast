import { getFinancialEntries } from "@/api/http/services/financial-entries";
import { getRestaurant } from "@/api/http/services/get-restaurant";
import {
	ability,
	getCurrentMembership,
	getCurrentRestaurant,
} from "@/providers/auth-provider";
import { BillingDetails } from "./~components/billing-details";
import { CreateExpenseSheet } from "./~components/create-expense-sheet";
import { FinancialEntries } from "./~components/financial-entries";

export default async function RestaurantBillingPage() {
	const permissions = await ability();
	const slug = await getCurrentRestaurant();
	const membership = await getCurrentMembership();
	const restaurant = slug ? (await getRestaurant(slug)).restaurant : null;
	const isOwner =
		membership?.role === "OWNER" && restaurant?.ownerId === membership?.userId;
	const entries =
		isOwner && slug ? (await getFinancialEntries(slug)).entries : [];

	const canGetBillingDetails = permissions?.can("get", "Billing");
	const canCreateExpense = permissions?.can("create", "Billing");

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="font-semibold text-2xl">Financeiro</h1>

				{canCreateExpense && <CreateExpenseSheet allowIncome={isOwner} />}
			</div>

			<div className="space-y-4">
				{isOwner && slug && (
					<FinancialEntries entries={entries} restaurant={slug} />
				)}
				{canGetBillingDetails && <BillingDetails />}
			</div>
		</div>
	);
}
