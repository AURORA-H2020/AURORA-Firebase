import { CountryLabelValues } from "./country-label-values";

/**
 * A country label structure
 */
export interface CountryLabelStructure {
  carbonEmission: {
    overall: CountryLabelValues[];
    electricity: CountryLabelValues[];
    heating: CountryLabelValues[];
    transportation: CountryLabelValues[];
  };
  energyExpended: {
    overall: CountryLabelValues[];
    electricity: CountryLabelValues[];
    heating: CountryLabelValues[];
    transportation: CountryLabelValues[];
  };
}
