import { Timestamp } from "firebase-admin/firestore";
import { ConsumptionCategory } from "./consumption-category";
import { ConsumptionElectricity } from "./electricity/consumption-electricity";
import { ConsumptionHeating } from "./heating/consumption-heating";
import { ConsumptionTransportation } from "./transportation/consumption-transportation";

/**
 * A consumption
 */
export interface Consumption {
  /**
   * The creation date
   */
  createdAt: Timestamp;
  /**
   * The last updated date
   */
  updatedAt?: Timestamp;
  /**
   * The category
   */
  category: ConsumptionCategory;
  /**
   * The electricity information
   */
  electricity?: ConsumptionElectricity;
  /**
   * The heating information
   */
  heating?: ConsumptionHeating;
  /**
   * The transportation information
   */
  transportation?: ConsumptionTransportation;
  /**
   * The value
   */
  value: number;
  /**
   * The version
   */
  version?: string;
  /**
   * The description
   */
  description?: string;
  /**
   * The carbon emissions
   */
  carbonEmissions?: number;
  /**
   * The energy expended
   */
  energyExpended?: number;
  /**
   * The recurring consumption identifier which auto generated this consumption
   */
  generatedByRecurringConsumptionId?: string;
  /**
   * The pv investment identifier which auto generated this consumption
   */
  generatedByPvInvestmentId?: string;
}
