import { Timestamp } from "firebase-admin/firestore";

export interface ConsumptionElectricity {
  costs: number;
  householdSize: number;
  startDate: Timestamp;
  endDate: Timestamp;
}
