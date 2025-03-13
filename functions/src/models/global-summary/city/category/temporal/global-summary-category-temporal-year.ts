import type { CategoryLabel } from "../../../label/consumption-type-labels";
import type { GlobalSummaryCategoryTemporalMonth } from "./global-sumaary-category-temporal-month";

export interface GlobalSummaryCategoryTemporalYear {
	year: string;
	categoryLabels: CategoryLabel[];
	data: GlobalSummaryCategoryTemporalMonth[];
}
