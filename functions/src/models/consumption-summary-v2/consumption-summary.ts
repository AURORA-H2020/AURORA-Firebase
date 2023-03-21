import { ConsumptionObject } from "./consumption-object";
import { Timestamp } from "firebase-admin/firestore";
import { ConsumptionCategory } from "../consumption/consumption-category";

/**
 * A consumption summary
 */

export interface ConsumptionSummaryEntry {
  year: number;
  version: string; // regenerate consumption if version mismatch
  dateLastUpdated?: Timestamp; // turn into FirebaseDate
  carbonEmission: ConsumptionObject;
  energyExpended: ConsumptionObject;
  categories: {
    category: ConsumptionCategory;
    carbonEmission: ConsumptionObject;
    energyExpended: ConsumptionObject;
    consumptionDays: {
      [day: number]: number;
    };
  }[];
  months: {
    number: number;
    carbonEmission: ConsumptionObject; // Only has "total" of consumptionObject
    energyExpended: ConsumptionObject;
    categories: {
      category: ConsumptionCategory;
      carbonEmission: ConsumptionObject;
      energyExpended: ConsumptionObject;
    }[];
  }[];
}
