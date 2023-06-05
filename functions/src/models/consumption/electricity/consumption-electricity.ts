import { Timestamp } from "firebase-admin/firestore";

/**
 * A consumption electricity
 */
export interface ConsumptionElectricity {
  /**
   * The costs
   */
  costs: number;
  /**
   * The size of the household
   */
  householdSize: number;
  /**
   * The start date
   */
  startDate: Timestamp;
  /**
   * The end date
   */
  endDate: Timestamp;
}
