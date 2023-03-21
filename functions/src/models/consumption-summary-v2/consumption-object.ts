/**
 * A consumption object
 */

export interface ConsumptionObject {
  total: number;
  percentage?: number;
  label?: string | undefined; // null/undefined instead of "?"
}
