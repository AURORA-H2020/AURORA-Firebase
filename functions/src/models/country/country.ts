import { LabelStructure } from "./labels/country-label-structure";

export interface Country {
  countryCode: string;
  currencyCode: string;
  labels: LabelStructure;
}
