import { api } from "../api-client";

interface RequestBillRequest {
	restaurant: string;
	tabId: string;
}

interface RequestBillResponse {
	table: { id: string; status: "BILL_REQUESTED" };
}

export async function requestBill({ restaurant, tabId }: RequestBillRequest) {
	const result = await api
		.patch(`restaurants/${restaurant}/tabs/${tabId}/request-bill`)
		.json<RequestBillResponse>();

	return result;
}
