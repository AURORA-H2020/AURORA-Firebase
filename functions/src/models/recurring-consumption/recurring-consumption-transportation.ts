import { ConsumptionTransportationType } from "../consumption/transportation/consumption-transportation-type";

export interface RecurringConsumptionTransportation {
  transportationType: ConsumptionTransportationType;
  hourOfTravel: number;
  minuteOfTravel: number;
  distance: number;
}
