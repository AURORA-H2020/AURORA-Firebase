import type { GlobalSummaryCountry } from "./country/global-summary-country";

export interface GlobalSummary {
	date: number; // Date of snapshot.
	daysPeriod: number; // Length of captured period (e.g. 7 days for 1 week).
	countries: GlobalSummaryCountry[];
}
