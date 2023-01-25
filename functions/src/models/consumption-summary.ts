import { ConsumptionSummaryEntry } from "./consumption-summary-entry";

/**
 * A consumption summary
 */
export interface ConsumptionSummary {
  totalCarbonEmissions: number;
  entries: ConsumptionSummaryEntry[];
}
