import { InterceptedSheetContent } from "@/components/intercepted-sheet-content";
import { Sheet, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RestaurantForm } from "../../restaurant/~components/restaurant-form";

export default function CreateRestaurantSheet() {
	return (
		<Sheet defaultOpen>
			<InterceptedSheetContent>
				<SheetHeader>
					<SheetTitle>Registrar restaurante</SheetTitle>
				</SheetHeader>

				<div className="p-4 pt-0">
					<RestaurantForm />
				</div>
			</InterceptedSheetContent>
		</Sheet>
	);
}
