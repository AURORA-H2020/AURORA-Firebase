import type { ConsumptionCategory } from "../../../consumption/consumption-category";
import type { GlobalSummaryCategorySource } from "./category-source/global-summary-category-source";
import type { GlobalSummaryCategoryTemporalYear } from "./temporal/global-summary-category-temporal-year";

export interface GlobalSummaryCategory {
	category: ConsumptionCategory; // Consumption category.
	carbonEmissions: number; // Total carbon emission in period.
	energyExpended: number; // Total energy used in period.
	consumptionsCount: number; // Number of consumptions
	activeUsers?: number; // Number of users included in period.
	categorySource: GlobalSummaryCategorySource[];
	temporal: GlobalSummaryCategoryTemporalYear[];
}
