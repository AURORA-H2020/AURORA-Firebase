export type Label = "A+" | "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface CategoryLabel {
  label: "unknown" | Label;
  carbonEmissions: number;
  energyExpended: number;
}
