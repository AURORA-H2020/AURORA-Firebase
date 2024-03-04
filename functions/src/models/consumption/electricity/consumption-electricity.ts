import { Timestamp } from "firebase-admin/firestore";
import { ConsumptionElectricitySource } from "./consumption-electricity-source";

/**
 * A consumption electricity
 */
export interface ConsumptionElectricity {
  /**
   * The costs
   */
  costs?: number;
  /**
   * The size of the household
   */
  householdSize: number;
  /**
   * The electricity type
   * Optional to support legacy consumptions before this property was introduced
   */
  electricitySource?: ConsumptionElectricitySource;
  /**
   * The exported electricity for home PV
   */
  electricityExported?: number;
  /**
   * The start date
   */
  startDate: Timestamp;
  /**
   * The end date
   */
  endDate: Timestamp;
}
