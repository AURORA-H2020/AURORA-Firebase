import { Timestamp } from "firebase-admin/firestore";
import { RecurringConsumptionFrequency } from "./recurring-consumption-frequency";
import { ConsumptionCategory } from "../consumption/consumption-category";
import { RecurringConsumptionTransportation } from "./recurring-consumption-transportation";

/**
 * A recurring consumption
 */
export interface RecurringConsumption {
  /**
   * The creation date
   */
  createdAt: Timestamp;
  /**
   * The frequency
   */
  frequency: RecurringConsumptionFrequency;
  /**
   * The category
   */
  category: ConsumptionCategory;
  /**
   * The transportation information
   */
  transportation?: RecurringConsumptionTransportation;
}
