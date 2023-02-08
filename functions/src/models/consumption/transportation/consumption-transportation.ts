import { Timestamp } from "firebase-admin/firestore";
import { ConsumptionTransportationType } from "./consumption-transportation-type";
import { ConsumptionTransportationPublicVehicleOccupancy } from "./consumption-transportation-public-vehicle-occupancy";

export interface ConsumptionTransportation {
  dateOfTravel: Timestamp;
  transportationType: ConsumptionTransportationType;
  privateVehicleOccupancy?: number;
  publicVehicleOccupancy?: ConsumptionTransportationPublicVehicleOccupancy;
}
