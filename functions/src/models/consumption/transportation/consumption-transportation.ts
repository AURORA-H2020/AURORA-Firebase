import { Timestamp } from "firebase-admin/firestore";
import { ConsumptionTransportationType } from "./consumption-transportation-type";
import { ConsumptionTransportationPublicVehicleOccupancy } from "./consumption-transportation-public-vehicle-occupancy";

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
   */
  transportationType: ConsumptionTransportationType;
  /**
   * The fuel consumption
   */
  fuelConsumption?: number;
  /**
   * The occupancy of a private vehicle
   */
  privateVehicleOccupancy?: number;
  /**
   * The occupancy of a public vehicle
   */
  publicVehicleOccupancy?: ConsumptionTransportationPublicVehicleOccupancy;
}
