import { Timestamp } from "firebase-admin/firestore";
import { ConsumptionCategory } from "./consumption-category";
import { ConsumptionElectricity } from "./electricity/consumption-electricity";
import { ConsumptionHeating } from "./heating/consumption-heating";
import { ConsumptionTransportation } from "./transportation/consumption-transportation";

export interface Consumption {
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  category: ConsumptionCategory;
  electricity?: ConsumptionElectricity;
  heating?: ConsumptionHeating;
  transportation?: ConsumptionTransportation;
  value: number;
  description?: string;
  carbonEmissions?: number;
  energyExpended?: number;
}
