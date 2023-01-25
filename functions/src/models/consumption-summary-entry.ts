import { ConsumptionCategory } from "./consumption-category";

/**
 * A consumption summary entry
 */
export interface ConsumptionSummaryEntry {
  category: ConsumptionCategory;
  value: number;
}
