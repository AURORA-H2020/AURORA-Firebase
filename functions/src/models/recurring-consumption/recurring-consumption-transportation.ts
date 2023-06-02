import { ConsumptionTransportationType } from "../consumption/transportation/consumption-transportation-type";

/**
 * A recurring consumption transportation
 */
export interface RecurringConsumptionTransportation {
  /**
   * The type of transportation
   */
  transportationType: ConsumptionTransportationType;
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
