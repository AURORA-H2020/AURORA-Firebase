import type { GlobalSummaryCity } from "../city/global-summary-city";

export interface GlobalSummaryCountry {
	countryID: string;
	cities: GlobalSummaryCity[];
}
