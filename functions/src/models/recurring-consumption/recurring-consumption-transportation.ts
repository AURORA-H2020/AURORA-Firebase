import { ConsumptionTransportationType } from "../consumption/transportation/consumption-transportation-type";
import { ConsumptionTransportationPublicVehicleOccupancy } from "../consumption/transportation/consumption-transportation-public-vehicle-occupancy";

/**
 * A recurring consumption transportation
 */
export interface RecurringConsumptionTransportation {
  /**
   * The type of transportation
   */
  transportationType: ConsumptionTransportationType;
  /**
   * The occupancy of a private vehicle
   */
  privateVehicleOccupancy?: number;
  /**
   * The occupancy of a public vehicle
   */
  publicVehicleOccupancy?: ConsumptionTransportationPublicVehicleOccupancy;
  /**
   * The hour of travel
   */
  hourOfTravel: number;
  /**
   * The minute of travel
   */
  minuteOfTravel: number;
  /**
   * The distance
   */
  distance: number;
}
