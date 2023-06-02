import { CountryLabelStructure } from "./labels/country-label-structure";

/**
 * A country
 */
export interface Country {
  /**
   * The ISO 3166 Alpha-2 country code
   */
  countryCode: string;
  /**
   * The ISO 4217 currency code
   */
  currencyCode: string;
  /**
   * The label structure
   */
  labels: CountryLabelStructure;
}
