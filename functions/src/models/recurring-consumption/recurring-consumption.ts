import { Timestamp } from "firebase-admin/firestore";
import { RecurringConsumptionFrequency } from "./recurring-consumption-frequency";
import { ConsumptionCategory } from "../consumption/consumption-category";
import { RecurringConsumptionTransportation } from "./recurring-consumption-transportation";

export interface RecurringConsumption {
  createdAt: Timestamp;
  frequency: RecurringConsumptionFrequency;
  category: ConsumptionCategory;
  transportation?: RecurringConsumptionTransportation;
}
