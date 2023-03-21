import { LabelValues } from "./country-label-values";

export interface LabelStructure {
  carbonEmission: {
    overall: LabelValues[];
    electricity: LabelValues[];
    heating: LabelValues[];
    transportation: LabelValues[];
  };
  energyExpended: {
    overall: LabelValues[];
    electricity: LabelValues[];
    heating: LabelValues[];
    transportation: LabelValues[];
  };
}
