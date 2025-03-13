import type { RecurringConsumptionFrequencyUnit } from "./recurring-consumption-frequency-unit";

/**
 * A recurring consumption frequency
 */
export interface RecurringConsumptionFrequency {
	/**
	 * The unit
	 */
	unit: RecurringConsumptionFrequencyUnit;
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
