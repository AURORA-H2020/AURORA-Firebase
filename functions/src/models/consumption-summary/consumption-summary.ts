import { ConsumptionSummaryLabeledConsumption } from "./consumption-summary-labeled-consumption";
import { Timestamp } from "firebase-admin/firestore";
import { ConsumptionCategory } from "../consumption/consumption-category";

/**
 * A consumption summary
 */
export interface ConsumptionSummary {
  year: number;
  version: string;
  dateLastUpdated?: Timestamp;
  carbonEmission: ConsumptionSummaryLabeledConsumption;
  energyExpended: ConsumptionSummaryLabeledConsumption;
  categories: {
    category: ConsumptionCategory;
    carbonEmission: ConsumptionSummaryLabeledConsumption;
    energyExpended: ConsumptionSummaryLabeledConsumption;
    consumptionDays: {
      [day: number]: number;
    };
  }[];
  months: {
    number: number;
    carbonEmission: ConsumptionSummaryLabeledConsumption;
    energyExpended: ConsumptionSummaryLabeledConsumption;
    categories: {
      category: ConsumptionCategory;
      carbonEmission: ConsumptionSummaryLabeledConsumption;
      energyExpended: ConsumptionSummaryLabeledConsumption;
    }[];
  }[];
}
