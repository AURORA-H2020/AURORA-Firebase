import { DeprecatedConsumptionSummaryEntry } from "./deprecated-consumption-summary-entry";

/**
 * @deprecated
 * An old variant of a consumption summary.
 * Please use "consumption-summary.ts"
 */
export interface DeprecatedConsumptionSummary {
  totalCarbonEmissions: number;
  entries: DeprecatedConsumptionSummaryEntry[];
}
