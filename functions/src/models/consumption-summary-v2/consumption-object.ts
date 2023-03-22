/**
 * A consumption object
 */

export interface ConsumptionObject {
  total: number;
  percentage?: number;
  label?: string | null; // null/undefined instead of "?"
}
