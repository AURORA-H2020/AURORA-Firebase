import { CategoryLabel } from "../../../label/consumption-type-labels";
import { GlobalSummaryCategoryTemporalMonth } from "./global-sumaary-category-temporal-month";

export interface GlobalSummaryCategoryTemporalYear {
  year: string;
  categoryLabels: CategoryLabel[];
  data: GlobalSummaryCategoryTemporalMonth[];
}
