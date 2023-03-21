import { UserGender } from "./user-gender";
import { ConsumptionSummary } from "../consumption-summary/consumption-summary";

export interface User {
  firstName: string;
  lastName: string;
  yearOfBirth?: number;
  gender?: UserGender;
  consumptionVersion?: string;
  country: string;
  city?: string;
  consumptionSummary?: ConsumptionSummary;
}
