import { ConsumptionCategory } from "../consumption/consumption-category";

/**
 * @deprecated
 * An old variant of a consumption summary entry.
 * Please use "consumption-summary.ts"
 */
export interface DeprecatedConsumptionSummaryEntry {
  category: ConsumptionCategory;
  value: number;
  absoluteValue: number;
}
