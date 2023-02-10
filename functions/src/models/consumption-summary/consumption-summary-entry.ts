import { ConsumptionCategory } from "../consumption/consumption-category";

/**
 * A consumption summary entry
 */
export interface ConsumptionSummaryEntry {
  category: ConsumptionCategory;
  value: number;
  absoluteValue: number;
}
