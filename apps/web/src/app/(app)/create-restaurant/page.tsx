import { Header } from "@/components/header";
import { RestaurantForm } from "../restaurant/~components/restaurant-form";

export default function CreateRestaurantPage() {
	return (
		<div className="space-y-4 py-4">
			<Header />

			<main className="mx-auto w-full max-w-300 space-y-4">
				<h1 className="font-semibold text-2xl">Registrar restaurante</h1>

				<RestaurantForm />
			</main>
		</div>
	);
}
