import type { Timestamp } from "firebase-admin/firestore";
import type { ConsumptionElectricitySource } from "./consumption-electricity-source";

/**
 * A consumption electricity
 */
export interface ConsumptionElectricity {
	/**
	 * The costs
	 */
	costs?: number;
	/**
	 * The size of the household in number of people
	 */
	householdSize: number;
	/**
	 * The electricity type
	 * Optional to support legacy consumptions before this property was introduced
	 * @see {@link ConsumptionElectricitySource}
	 */
	electricitySource?: ConsumptionElectricitySource;
	/**
	 * The exported electricity for home PV in kWh
	 */
	electricityExported?: number;
	/**
	 * The start date
	 */
	startDate: Timestamp;
	/**
	 * The end date
	 */
	endDate: Timestamp;
}
