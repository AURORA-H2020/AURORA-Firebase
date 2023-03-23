import { UserGender } from "./user-gender";
import { MetaData } from "./user-consumption-meta";
import { ConsumptionSummary } from "../consumption-summary/consumption-summary";

export interface User {
  firstName: string;
  lastName: string;
  yearOfBirth?: number;
  gender?: UserGender;
  consumptionMeta: MetaData;
  consumptionSummaryMeta: MetaData;
  country: string;
  city?: string;
  consumptionSummary?: ConsumptionSummary;
}
