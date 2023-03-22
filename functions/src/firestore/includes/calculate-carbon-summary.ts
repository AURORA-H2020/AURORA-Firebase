import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { Consumption } from "../../models/consumption/consumption";
import { ConsumptionSummaryEntry } from "../../models/consumption-summary-v2/consumption-summary";
import { ConsumptionCategory } from "../../models/consumption/consumption-category";
import { FirestoreCollections } from "../../utils/firestore-collections";

import { LabelStructure } from "../../models/country/labels/country-label-structure";
import { LabelValues } from "../../models/country/labels/country-label-values";
import { User } from "../../models/user/user";
// import { User } from "../../models/user/user";

/*
interface ConsumptionSummaryCollection {
  entries: ConsumptionSummaryEntry[] | undefined;
}
*/

function newConsumptionSummaryEntry(year: number, categories: string[]) {
  const consumptionSummaryEntry: ConsumptionSummaryEntry = {
    year: year,
    version: "1.0.0",
    dateLastUpdated: Timestamp.fromDate(new Date()),
    carbonEmission: {
      total: 0,
      label: undefined,
    },
    energyExpended: {
      total: 0,
      label: undefined,
    },
    categories: [],
    months: [],
  };

  categories.forEach((e) => {
    consumptionSummaryEntry.categories.push({
      category: e as ConsumptionCategory,
      carbonEmission: {
        total: 0,
        percentage: 0,
        label: undefined,
      },
      energyExpended: {
        total: 0,
        percentage: 0,
        label: undefined,
      },
      consumptionDays: {},
    });
  });

  return consumptionSummaryEntry;
}

function newMonthlyConsumptionSummary(month: number) {
  const monthlyConsumptionSummary = {
    number: month,
    carbonEmission: {
      total: 0,
    },
    energyExpended: {
      total: 0,
    },
    categories: [],
  };

  return monthlyConsumptionSummary;
}

function newMonthlyConsumptionCategory(category: ConsumptionCategory) {
  const monthlyConsumptionCategorySummary = {
    category: category,
    carbonEmission: {
      total: 0,
      percentage: 0,
    },
    energyExpended: {
      total: 0,
      percentage: 0,
    },
  };

  return monthlyConsumptionCategorySummary;
}

function updateConsumptionSummaryEntries(
  consumption: Consumption,
  labelStructure: LabelStructure,
  currentVersion: string,
  consumptionSummaryEntries?: ConsumptionSummaryEntry[],
  deleteAction = false
): ConsumptionSummaryEntry[] | undefined {
  const categories: ConsumptionCategory[] = ["heating", "electricity", "transportation"];

  // get carbonEmissionValue and energyExpendedValue from current consumption
  let carbonEmissionValue = consumption.carbonEmissions;
  let energyExpendedValue = consumption.energyExpended;

  // Only proceed if both values are not undefined
  if (carbonEmissionValue && energyExpendedValue) {
    // reverse values if this is a delete action
    if (deleteAction) {
      carbonEmissionValue *= -1;
      energyExpendedValue *= -1;
    }

    let startDate: Timestamp;
    let endDate: Timestamp;

    // Check which consumption type is being added and get date accordingly
    if (consumption.electricity) {
      startDate = consumption.electricity.startDate;
      endDate = consumption.electricity.endDate;
    } else if (consumption.heating) {
      startDate = consumption.heating.startDate;
      endDate = consumption.heating.endDate;
    } else if (consumption.transportation) {
      startDate = consumption.transportation.dateOfTravel;
      endDate = consumption.transportation.dateOfTravel;
    } else {
      throw new Error("Consumption type cannot unknown for consumption:" + JSON.stringify(consumption));
    }

    const monthlyEnergyExpendedDistribution = calculateMonthlyConsumptionDistribution(
      startDate,
      endDate,
      energyExpendedValue
    );
    const monthlyCarbonEmissionDistribution = calculateMonthlyConsumptionDistribution(
      startDate,
      endDate,
      carbonEmissionValue
    );

    if (!monthlyCarbonEmissionDistribution || !monthlyEnergyExpendedDistribution) {
      throw new Error(
        "Monthly Distribution undefined. \n monthlyCarbonEmissionDistribution: " +
          JSON.stringify(monthlyCarbonEmissionDistribution) +
          "\n monthlyEnergySpendedDistribution: " +
          JSON.stringify(monthlyEnergyExpendedDistribution)
      );
    }

    // iterate over years in consumption and ensure a consumption summary exists.
    Object.entries(monthlyCarbonEmissionDistribution).forEach((yearEntry) => {
      const year = Number(yearEntry[0]);

      // create consumption summary if it does not exist
      if (!consumptionSummaryEntries) {
        consumptionSummaryEntries = [newConsumptionSummaryEntry(year, categories)];
      }

      // create year if it does not exist
      if (!consumptionSummaryEntries.some((e) => e.year == year)) {
        consumptionSummaryEntries.push(newConsumptionSummaryEntry(year, categories));
      }

      const annualConsumption = ensure(consumptionSummaryEntries.find((e) => e.year === year));
      console.log("--- annualConsumption ---");
      console.log(JSON.stringify(annualConsumption));

      let thisCarbonEmissionAnnualTotal = 0;
      let thisEnergyUsedAnnualTotal = 0;

      annualConsumption.version = currentVersion;
      annualConsumption.dateLastUpdated = Timestamp.fromDate(new Date());

      Object.entries(monthlyCarbonEmissionDistribution[year]).forEach((monthEntry) => {
        const month = Number(monthEntry[0]);

        // create month if it does not exist
        if (!annualConsumption.months.some((e) => e.number == month)) {
          annualConsumption.months.push(newMonthlyConsumptionSummary(month));
        }

        const monthlyConsumption = ensure(annualConsumption.months.find((e) => e.number === month));
        console.log("--- monthlyConsumption ---");
        console.log(JSON.stringify(monthlyConsumption));

        // increase monthly consumption total
        monthlyConsumption.carbonEmission.total += monthlyCarbonEmissionDistribution[year][month];
        monthlyConsumption.energyExpended.total += monthlyEnergyExpendedDistribution[year][month];

        // loop over categories and update them accordingly. This is required for updating percentages in all categories
        categories.forEach((category) => {
          if (!monthlyConsumption.categories.some((e) => e.category == category)) {
            monthlyConsumption.categories.push(newMonthlyConsumptionCategory(category));
          }

          const monthlyCategoryConsumption = ensure(monthlyConsumption.categories.find((e) => e.category === category));
          console.log("--- monthlyCategoryConsumption ---");
          console.log(JSON.stringify(monthlyCategoryConsumption));

          // only add consumption value if category matches
          if (category === consumption.category) {
            monthlyCategoryConsumption.carbonEmission.total += monthlyCarbonEmissionDistribution[year][month];
            monthlyCategoryConsumption.energyExpended.total += monthlyEnergyExpendedDistribution[year][month];

            // add consumption value to overall total
            annualConsumption.carbonEmission.total += monthlyCarbonEmissionDistribution[year][month];
            thisCarbonEmissionAnnualTotal += monthlyCarbonEmissionDistribution[year][month];

            annualConsumption.energyExpended.total += monthlyEnergyExpendedDistribution[year][month];
            thisEnergyUsedAnnualTotal += monthlyEnergyExpendedDistribution[year][month];
          }

          // recalculate percentages
          if (monthlyConsumption.carbonEmission.total != 0) {
            monthlyCategoryConsumption.carbonEmission.percentage =
              monthlyCategoryConsumption.carbonEmission.total / monthlyConsumption.carbonEmission.total;
            monthlyCategoryConsumption.energyExpended.percentage =
              monthlyCategoryConsumption.energyExpended.total / monthlyConsumption.energyExpended.total;
          }
        });
      });

      // iterate over consumption summary categories to update value of given consumption category and percentages for all
      annualConsumption.categories.forEach((categorySummary) => {
        if (categorySummary.category === consumption.category) {
          categorySummary.carbonEmission.total += thisCarbonEmissionAnnualTotal;
          categorySummary.energyExpended.total += thisEnergyUsedAnnualTotal;
          // create array with count of consumptions per day over a year
          categorySummary.consumptionDays = consumptionDaysArray(
            startDate,
            endDate,
            year,
            categorySummary.consumptionDays,
            deleteAction
          );
        }
        categorySummary.carbonEmission.percentage =
          categorySummary.carbonEmission.total / annualConsumption.carbonEmission.total;
        categorySummary.energyExpended.percentage =
          categorySummary.energyExpended.total / annualConsumption.energyExpended.total;
      });
    });

    calculateConsumptionLabel(labelStructure, consumptionSummaryEntries);

    return consumptionSummaryEntries;
  } else {
    throw new Error(
      "Carbon Emission and/or Energy Expended do not exist on consumption:" + JSON.stringify(consumption)
    );
  }
}

function ensure<T>(argument: T | undefined | null, message = "This value was promised to be there."): T {
  if (argument === undefined || argument === null) {
    throw new TypeError(message);
  }

  return argument;
}

function calculateConsumptionLabel(
  labelStructure: LabelStructure,
  consumptionSummaryEntries?: ConsumptionSummaryEntry[]
) {
  if (!consumptionSummaryEntries) {
    throw new Error("consumptionSummaryEntries is undefined: " + JSON.stringify(consumptionSummaryEntries));
  };

  consumptionSummaryEntries.forEach((consumptionSummaryEntry) => {
    const overallCarbonEmissionLabels: LabelValues[] = [];
    const overallEnergyExpendedLabels: LabelValues[] = [];

    consumptionSummaryEntry.categories.forEach((categorySummary) => {
      const carbonEmissionCategoryLabels: LabelValues[] = JSON.parse(
        JSON.stringify(
          labelStructure.carbonEmission[categorySummary.category as keyof typeof labelStructure.carbonEmission]
        )
      );
      const energyUsedCategoryLabels: LabelValues[] = JSON.parse(
        JSON.stringify(
          labelStructure.energyExpended[categorySummary.category as keyof typeof labelStructure.energyExpended]
        )
      );

      // get factor of consumptions entered based on number of days of data entry
      let consumptionDaysCount = 0;
      for (const day in categorySummary.consumptionDays) {
        if (categorySummary.consumptionDays[day] > 0) consumptionDaysCount += 1;
      }
      let consumptionLabelFactor = consumptionDaysCount / Object.keys(categorySummary.consumptionDays).length;
      if (!consumptionLabelFactor) consumptionLabelFactor = 0;

      // adjust labelValues based on first consumption date and current day
      carbonEmissionCategoryLabels.map((singleCarbonEmissionLabel) => {
        singleCarbonEmissionLabel.maximum *= consumptionLabelFactor;
        singleCarbonEmissionLabel.minimum *= consumptionLabelFactor;
      });

      energyUsedCategoryLabels.map((singleEnergyUsedLabel) => {
        singleEnergyUsedLabel.maximum *= consumptionLabelFactor;
        singleEnergyUsedLabel.minimum *= consumptionLabelFactor;
      });

      // console.log(JSON.stringify(labelValues,null,2))
      carbonEmissionCategoryLabels.forEach((carbonEmissionLabel) => {
        if (
          carbonEmissionLabel.maximum > categorySummary.carbonEmission.total &&
          carbonEmissionLabel.minimum < categorySummary.carbonEmission.total
        ) {
          categorySummary.carbonEmission.label = carbonEmissionLabel.label;
        }

        // construct overall label if current label is not "overall"
        const i = overallCarbonEmissionLabels.findIndex((OCELabel) => OCELabel.label === carbonEmissionLabel.label);
        if (i > -1) {
          overallCarbonEmissionLabels[i].maximum += carbonEmissionLabel.maximum;
          overallCarbonEmissionLabels[i].minimum += carbonEmissionLabel.minimum;
        } else {
          overallCarbonEmissionLabels.push({ ...carbonEmissionLabel });
        }
      });

      energyUsedCategoryLabels.forEach((energyUsedLabel) => {
        if (
          energyUsedLabel.maximum > categorySummary.energyExpended.total &&
          energyUsedLabel.minimum < categorySummary.energyExpended.total
        ) {
          categorySummary.energyExpended.label = energyUsedLabel.label;
        }

        // construct overall label if current label is not "overall"
        const i = overallEnergyExpendedLabels.findIndex(
          (overallEnergyExpendedLabel) => overallEnergyExpendedLabel.label === energyUsedLabel.label
        );
        if (i > -1) {
          overallEnergyExpendedLabels[i].maximum += energyUsedLabel.maximum;
          overallEnergyExpendedLabels[i].minimum += energyUsedLabel.minimum;
        } else {
          overallEnergyExpendedLabels.push({ ...energyUsedLabel });
        }
      });
    });

    // find label for overall annual consumption
    overallCarbonEmissionLabels.forEach((overallCarbonEmissionLabel) => {
      if (
        overallCarbonEmissionLabel.maximum > consumptionSummaryEntry.carbonEmission.total &&
        overallCarbonEmissionLabel.minimum < consumptionSummaryEntry.carbonEmission.total
      ) {
        consumptionSummaryEntry.carbonEmission.label = overallCarbonEmissionLabel.label;
      }
    });
    overallEnergyExpendedLabels.forEach((overallEnergyExpendedLabel) => {
      if (
        overallEnergyExpendedLabel.maximum > consumptionSummaryEntry.energyExpended.total &&
        overallEnergyExpendedLabel.minimum < consumptionSummaryEntry.energyExpended.total
      ) {
        consumptionSummaryEntry.energyExpended.label = overallEnergyExpendedLabel.label;
      }
    });
  });

  return consumptionSummaryEntries;
}

function calculateMonthlyConsumptionDistribution(
  startDateTimestamp: Timestamp,
  endDateTimestamp: Timestamp,
  consumptionValue: number
): { [year: number]: { [months: number]: number } } {
  const startDate = new Date(startDateTimestamp.seconds * 1000);
  const endDate = new Date(endDateTimestamp.seconds * 1000);

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  const monthlyConsumptionDistribution: {
    [year: number]: { [months: number]: number };
  } = {};
  let totalDays = 0;

  for (let year = startYear; year <= endYear; year++) {
    monthlyConsumptionDistribution[year] = {};

    const maxMonth = year === endYear ? endMonth : 11;
    const minMonth = year === startYear ? startMonth : 0;

    for (let month = minMonth; month <= maxMonth; month++) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const monthStart = year === startYear && month === startMonth ? startDay : 1;
      const monthEnd = year === endYear && month === endMonth ? endDay : daysInMonth;
      const daysInTimeframe = monthEnd - monthStart + 1;
      monthlyConsumptionDistribution[year][month + 1] = daysInTimeframe;
      totalDays += daysInTimeframe;
    }
  }

  Object.entries(monthlyConsumptionDistribution).forEach((year) => {
    Object.entries(year[1]).forEach((month) => {
      monthlyConsumptionDistribution[Number(year[0])][Number(month[0])] = (month[1] / totalDays) * consumptionValue;
    });
  });

  return monthlyConsumptionDistribution;
}

function consumptionDaysArray(
  startDateTimestamp: Timestamp,
  endDateTimestamp: Timestamp,
  forYear: number,
  arr?: { [day: number]: number },
  deleteAction = false
): { [day: number]: number } {
  const startDate = new Date(startDateTimestamp.seconds * 1000);
  const endDate = new Date(endDateTimestamp.seconds * 1000);
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  let countValue = 1;
  if (deleteAction) countValue *= -1;

  if (!arr) {
    arr = {};
  }

  for (let year = startYear; year <= endYear; year++) {
    if (year != forYear) continue;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 0);
    const yearLength = Math.ceil((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    for (let j = 0; j < yearLength; j++) {
      if (!arr[j]) arr[j] = 0;
      const currentDate = new Date(yearStart.getTime() + j * 24 * 60 * 60 * 1000);
      if (currentDate >= startDate && currentDate <= endDate) {
        arr[j] += countValue;
      } else {
        arr[j] += 0;
      }
    }
  }

  return arr;
}

export async function calculateConsumptionSummary(
  user: User,
  consumption: Consumption,
  context: functions.EventContext<Record<string, string>>
) {
  // Version of this implementation of the calculateConsumptionSummary function. Increase to trigger recalculating all entries on next data entry.
  const latestConsumptionSummaryVersion = "1.0.0";

  const countryLabels = (
    await admin.firestore().collection(FirestoreCollections.countries.name).doc(user.country).get()
  ).data()?.labels;
  if (!countryLabels) return;

  let consumptionSummaryArray: ConsumptionSummaryEntry[] | undefined = [];

  console.log("--- countryLabels ---");
  console.log(JSON.stringify(countryLabels));
  console.log("--- incoming consumption ---");
  console.log(JSON.stringify(consumption));

  // get existing consumption summary, if any.
  await admin
    .firestore()
    .collection(FirestoreCollections.users.name)
    .doc(context.params.userId)
    .collection(FirestoreCollections.users.consumptionSummaries.name)
    .get()
    .then((snapshot) => {
      snapshot.forEach((consumptionSummaryEntry) => {
        consumptionSummaryArray?.push(consumptionSummaryEntry.data() as ConsumptionSummaryEntry);
      });
    });

  console.log("--- consumptionSummaryArray (1) ---")
  console.log(JSON.stringify(consumptionSummaryArray))

  if (latestConsumptionSummaryVersion == user.consumptionSummaryVersion && consumptionSummaryArray.length > 0) {
    consumptionSummaryArray = updateConsumptionSummaryEntries(
      consumption as Consumption,
      countryLabels,
      latestConsumptionSummaryVersion,
      consumptionSummaryArray
    );
  } else {
    await admin
      .firestore()
      .collection(FirestoreCollections.users.name)
      .doc(context.params.userId)
      .collection(FirestoreCollections.users.consumptions.name)
      .get()
      .then((snapshot) => {
        snapshot.forEach((consumption) => {
          console.log("--- consumption in forEach loop ---")
          console.log(JSON.stringify(consumption))
          consumptionSummaryArray = updateConsumptionSummaryEntries(
            consumption.data() as Consumption,
            countryLabels,
            latestConsumptionSummaryVersion,
            consumptionSummaryArray
          );
          console.log("--- consumptionSummaryArray (2) ---")
          console.log(JSON.stringify(consumptionSummaryArray))
          console.log("--- END FOREACH LOOP ---")
        });
      });
    if (consumptionSummaryArray) {
      // Write latest version to user after recalculating all consumptions
      await admin.firestore().collection(FirestoreCollections.users.name).doc(context.params.userId).update({
        latestConsumptionVersion: latestConsumptionSummaryVersion,
      });
    }
  }

  console.log("--- consumptionSummaryArray (3) ---")
  console.log(JSON.stringify(consumptionSummaryArray))

  consumptionSummaryArray?.forEach(async (consumptionSummary) => {
    await admin
      .firestore()
      .collection(FirestoreCollections.users.name)
      .doc(context.params.userId)
      .collection(FirestoreCollections.users.consumptionSummaries.name)
      .doc(String(consumptionSummary.year))
      .set(consumptionSummary);
  });
}
