import { ConsumptionSummaryEntry } from "./consumption-summary-entry.model";

/**
 * A consumption summary
 */
export interface ConsumptionSummary {
  totalCarbonEmissions: number;
  entries: ConsumptionSummaryEntry[];
}
