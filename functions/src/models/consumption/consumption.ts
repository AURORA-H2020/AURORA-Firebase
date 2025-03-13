import type { Timestamp } from "firebase-admin/firestore";
import type { ConsumptionCategory } from "./consumption-category";
import type { ConsumptionElectricity } from "./electricity/consumption-electricity";
import type { ConsumptionHeating } from "./heating/consumption-heating";
import type { ConsumptionTransportation } from "./transportation/consumption-transportation";

/**
 * Represents a single consumption entry in the carbon tracking system.
 * Consumptions track resource usage across different categories (electricity, heating, transportation)
 * and calculate the associated carbon emissions.
 */
export interface Consumption {
	/**
	 * The timestamp when this consumption entry was created
	 */
	createdAt: Timestamp;
	/**
	 * The timestamp when this consumption entry was last modified
	 */
	updatedAt?: Timestamp;
	/**
	 * The category of the consumption, which determines valid values and calculation methods
	 * @see {@link ConsumptionCategory}
	 * @note Only one of electricity, heating, or transportation should be provided based on this category
	 */
	category: ConsumptionCategory;
	/**
	 * The electricity-specific information (required when category is electricity-related)
	 * @see {@link ConsumptionElectricity}
	 */
	electricity?: ConsumptionElectricity;
	/**
	 * The heating-specific information (required when category is heating-related)
	 * @see {@link ConsumptionHeating}
	 */
	heating?: ConsumptionHeating;
	/**
	 * The transportation-specific information (required when category is transportation-related)
	 * @see {@link ConsumptionTransportation}
	 */
	transportation?: ConsumptionTransportation;
	/**
	 * Value of the consumption as entered by the user
	 * The unit depends on the category:
	 * - Electricity: kWh
	 * - Heating: kWh (e.g. district), liters (e.g. oil), kg (e.g. wood)
	 * - Transportation: km (distance)
	 */
	value: number;
	/**
	 * Schema version for this consumption object
	 * Used to handle data migration when the schema changes
	 * @format semver (e.g. "1.0.0")
	 * @default "1.0.0"
	 */
	version?: string;
	/**
	 * User-provided description or notes about this consumption entry
	 */
	description?: string;
	/**
	 * The carbon emissions in kg CO2 equivalent
	 * Automatically calculated from the value and category-specific factors
	 */
	carbonEmissions?: number;
	/**
	 * The energy expended in kilowatt-hours (kWh)
	 * Automatically calculated from the value and category-specific conversion factors
	 */
	energyExpended?: number;
	/**
	 * Reference to a recurring consumption schedule that automatically generated this entry
	 * When present, this consumption was created by the system rather than manual user input
	 * @see RecurringConsumption collection
	 */
	generatedByRecurringConsumptionId?: string;
	/**
	 * Reference to a photovoltaic investment that generated this consumption entry
	 * Used for tracking energy production from user's solar installations
	 * @see PvInvestment collection
	 */
	generatedByPvInvestmentId?: string;
}
