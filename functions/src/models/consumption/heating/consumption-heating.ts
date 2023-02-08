import { Timestamp } from "firebase-admin/firestore";
import { ConsumptionHeatingFuel } from "./consumption-heating-fuel";
import { ConsumptionDistrictHeatingSource } from "./consumption-district-heating-source";

export interface ConsumptionHeating {
  costs: number;
  householdSize: number;
  startDate: Timestamp;
  endDate: Timestamp;
  heatingFuel: ConsumptionHeatingFuel;
  districtHeatingSource?: ConsumptionDistrictHeatingSource;
}
