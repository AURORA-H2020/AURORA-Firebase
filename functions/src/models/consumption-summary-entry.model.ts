import { ConsumptionCategory } from "./consumption-category.model";

/**
 * A consumption summary entry
 */
export interface ConsumptionSummaryEntry {
  category: ConsumptionCategory;
  value: number;
}
