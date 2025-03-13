import type { GlobalSummaryCategory } from "./category/global-summary-category";
import type { GlobalSummaryDemographicCategory } from "./demographic-category/global-summary-demographic-category";

export interface GlobalSummaryCity {
	cityID: string | undefined;
	categories: GlobalSummaryCategory[];
	users: {
		userCount: number; // Total users for the city at that time.
		consumptionsCount: number; // Total consumptions for the city at that time.
		recurringConsumptionsCount?: number; // Total recurring consumptions for the city at that time.
		genders: GlobalSummaryDemographicCategory[]; // Array of genders for the city at that time.
	};
}
