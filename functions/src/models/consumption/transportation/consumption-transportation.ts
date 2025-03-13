import type { Timestamp } from "firebase-admin/firestore";
import type { ConsumptionTransportationType } from "./consumption-transportation-type";
import type { ConsumptionTransportationPublicVehicleOccupancy } from "./consumption-transportation-public-vehicle-occupancy";

/**
 * A consumption transportation
 */
export interface ConsumptionTransportation {
	/**
	 * The date of the travel
	 */
	dateOfTravel: Timestamp;
	/**
	 * The end date of the travel
	 */
	dateOfTravelEnd?: Timestamp;
	/**
	 * The type of transportation
	 * @see {@link ConsumptionTransportationType}
	 */
	transportationType: ConsumptionTransportationType;
	/**
	 * The fuel consumption
	 */
	fuelConsumption?: number;
	/**
	 * The occupancy of a private vehicle in number of passengers
	 */
	privateVehicleOccupancy?: number;
	/**
	 * The occupancy of a public vehicle
	 * @see {@link ConsumptionTransportationPublicVehicleOccupancy}
	 */
	publicVehicleOccupancy?: ConsumptionTransportationPublicVehicleOccupancy;
}
