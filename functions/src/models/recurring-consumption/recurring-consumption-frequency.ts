/**
 * A recurring consumption frequency
 */
export interface RecurringConsumptionFrequency {
  /**
   * The unit
   */
  unit: "daily" | "weekly" | "monthly";
  /**
   * The weekdays.
   * Applicable if unit is set to `weekly`
   */
  weekdays?: number[];
  /**
   * The day of month.
   * Applicable if unit is set to `monthly`
   */
  dayOfMonth?: number;
}
