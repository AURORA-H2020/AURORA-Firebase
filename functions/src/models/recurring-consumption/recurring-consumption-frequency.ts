/**
 * A recurring consumption frequency
 */
export interface RecurringConsumptionFrequency {
  /**
   * The unit
   */
  unit: "daily" | "weekly" | "monthly";
  /**
   * The value
   */
  value: number;
}
