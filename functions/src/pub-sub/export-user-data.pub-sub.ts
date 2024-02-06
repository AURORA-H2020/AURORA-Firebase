/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { storage } from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { ConsumptionSummary } from "../models/consumption-summary/consumption-summary";
import { Consumption } from "../models/consumption/consumption";
import { ConsumptionCategory } from "../models/consumption/consumption-category";
import { GlobalSummaryCategorySource } from "../models/global-summary/city/category/category-source/global-summary-category-source";
import { GlobalSummaryCategory } from "../models/global-summary/city/category/global-summary-category";
import { GlobalSummaryCategoryTemporalMonth } from "../models/global-summary/city/category/temporal/global-sumaary-category-temporal-month";
import { GlobalSummaryCategoryTemporalYear } from "../models/global-summary/city/category/temporal/global-summary-category-temporal-year";
import { GlobalSummaryDemographicCategory } from "../models/global-summary/city/demographic-category/global-summary-demographic-category";
import { GlobalSummaryCity } from "../models/global-summary/city/global-summary-city";
import { GlobalSummaryCountry } from "../models/global-summary/country/global-summary-country";
import { GlobalSummary } from "../models/global-summary/global-summary";
import { CategoryLabel, Label } from "../models/global-summary/label/consumption-type-labels";
import { RecurringConsumption } from "../models/recurring-consumption/recurring-consumption";
import { User } from "../models/user/user";
import { FirebaseConstants } from "../utils/firebase-constants";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

interface UserWithSubCollections extends User {
  consumptions?: Consumption[];
  consumptionSummaries?: ConsumptionSummary[];
  recurringConsumptions?: RecurringConsumption[];
}

interface ConsolidatedUsers {
  [userId: string]: UserWithSubCollections;
}

/**
 * Transforms the provided export data into a summary object.
 * @param {ConsolidatedUsers} userDataMap - The source data to transform.
 * @returns {GlobalSummary} The transformed summary object.
 */
function transformUserData(userDataMap: ConsolidatedUsers, userIdBlacklist: string[]): GlobalSummary {
  const globalSummary: GlobalSummary = {
    date: new Date().getTime(),
    daysPeriod: 1,
    countries: [],
  };

  Object.keys(userDataMap).forEach((userID) => {
    if (userIdBlacklist.includes(userID)) {
      return; // Skip blacklisted users
    }

    const userData = userDataMap[userID] as UserWithSubCollections;

    let currentCountry = globalSummary.countries.find((e) => e.countryID === (userData.country || "otherCountry"));
    if (!currentCountry) {
      const countryID = userData.country ?? "otherCountry";
      globalSummary.countries.push(newCountry(countryID));
      currentCountry = globalSummary.countries.find((e) => e.countryID === countryID);
    }

    let currentCity = currentCountry?.cities.find((e) => e.cityID === (userData.city || "otherCity"));
    if (!currentCity) {
      const cityID = userData.city ?? "otherCity";
      currentCountry!.cities.push(newCity(cityID));
      currentCity = currentCountry?.cities.find((e) => e.cityID === cityID);
    }

    let currentGender = currentCity?.users.genders.find(
      (e) => e.demographicCategory === (userData.gender || "unknown")
    );
    if (!currentGender) {
      const genderName = userData.gender ?? "unknown";
      currentCity?.users.genders.push(newGender(genderName));
      currentGender = currentCity?.users.genders.find((e) => e.demographicCategory === genderName);
    }

    currentGender!.count ??= 0;
    currentGender!.count++;

    currentCity!.users.userCount ??= 0;
    currentCity!.users.userCount++;

    if (hasConsumptions(userData)) {
      userData.consumptions?.forEach((consumption) => {
        currentCity!.users.consumptionsCount = (currentCity?.users.consumptionsCount || 0) + 1;

        let category = currentCity?.categories.find((e) => e.category === consumption.category);
        if (!category) {
          currentCity?.categories.push(newConsumptionSummary(consumption.category));
          category = currentCity?.categories.find((e) => e.category === consumption.category);
        }

        category!.carbonEmissions = (category?.carbonEmissions || 0) + (consumption.carbonEmissions || 0);
        category!.energyExpended = (category?.energyExpended || 0) + (consumption.energyExpended || 0);
        category!.consumptionsCount = (category?.consumptionsCount || 0) + 1;

        if (consumption.category === "electricity") {
          const inputSource = consumption.electricity?.electricitySource || "default";
          let source = category?.categorySource.find((e) => e.source === inputSource);
          if (!source) {
            category?.categorySource.push(newConsumptionSource(inputSource));
            source = category?.categorySource.find((e) => e.source === inputSource);
          }
          source!.carbonEmissions = (source?.carbonEmissions || 0) + (consumption.carbonEmissions || 0);
          source!.energyExpended = (source?.energyExpended || 0) + (consumption.energyExpended || 0);
          source!.value = (source?.value || 0) + (consumption.value || 0);
          source!.count = (source?.count || 0) + 1;
        } else if (consumption.category === "heating") {
          const inputSource = consumption.heating?.heatingFuel;
          if (inputSource) {
            let source = category?.categorySource.find((e) => e.source === inputSource);
            if (!source) {
              category?.categorySource.push(newConsumptionSource(inputSource));
              source = category?.categorySource.find((e) => e.source === inputSource);
            }
            source!.carbonEmissions = (source?.carbonEmissions || 0) + (consumption.carbonEmissions || 0);
            source!.energyExpended = (source?.energyExpended || 0) + (consumption.energyExpended || 0);
            source!.value = (source?.value || 0) + (consumption.value || 0);
            source!.count = (source?.count || 0) + 1;
          }
        } else if (consumption.category === "transportation") {
          const inputSource = consumption.transportation?.transportationType;
          if (inputSource) {
            let source = category?.categorySource.find((e) => e.source === inputSource);
            if (!source) {
              category?.categorySource.push(newConsumptionSource(inputSource));
              source = category?.categorySource.find((e) => e.source === inputSource);
            }
            source!.carbonEmissions = (source?.carbonEmissions || 0) + (consumption.carbonEmissions || 0);
            source!.energyExpended = (source?.energyExpended || 0) + (consumption.energyExpended || 0);
            source!.value = (source?.value || 0) + (consumption.value || 0);
            source!.count = (source?.count || 0) + 1;
          }
        }
      });
    }

    if (hasConsumptionSummary(userData)) {
      userData.consumptionSummaries?.forEach((consumptionSummary) => {
        const consumptionSummaryYear = consumptionSummary.year.toString();

        consumptionSummary.categories.forEach((category) => {
          if (currentCity) {
            currentCity = ensureConsumptionSummary(currentCity, category.category);
          }

          const currentCategory = currentCity?.categories.find((e) => e.category === category.category);
          let currentYear = currentCategory?.temporal.find((e) => e.year === consumptionSummaryYear);
          if (!currentYear) {
            currentCategory?.temporal.push(newSummaryYear(consumptionSummaryYear));
            currentCategory?.temporal.sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
            currentYear = currentCategory?.temporal.find((e) => e.year === consumptionSummaryYear);
          }

          const currentCarbonEmissionsLabel = currentYear!.categoryLabels.find(
            (e) => e.label === validateLabel(category.carbonEmission.label)
          );

          if (!currentCarbonEmissionsLabel) {
            currentYear!.categoryLabels.push(newLabel(validateLabel(category.carbonEmission.label)));
          } else {
            currentCarbonEmissionsLabel.carbonEmissions = (currentCarbonEmissionsLabel.carbonEmissions || 0) + 1;
          }

          const currentEnergyExpendedLabel = currentYear!.categoryLabels.find(
            (e) => e.label === validateLabel(category.energyExpended.label)
          );

          if (!currentEnergyExpendedLabel) {
            currentYear!.categoryLabels.push(newLabel(validateLabel(category.energyExpended.label)));
          } else {
            currentEnergyExpendedLabel.energyExpended = (currentEnergyExpendedLabel.energyExpended || 0) + 1;
          }
        });

        consumptionSummary.months.forEach((month) => {
          month.categories.forEach((category) => {
            if (currentCity) {
              currentCity = ensureConsumptionSummary(currentCity, category.category);
            }

            const currentCategory = currentCity?.categories.find((e) => e.category === category.category);
            let currentYear = currentCategory?.temporal.find((e) => e.year === consumptionSummaryYear);
            if (!currentYear) {
              currentCategory?.temporal.push(newSummaryYear(consumptionSummaryYear));
              currentCategory?.temporal.sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
              currentYear = currentCategory?.temporal.find((e) => e.year === consumptionSummaryYear);
            }
            let currentMonth = currentYear?.data.find((e) => e.month === month.number);
            if (!currentMonth) {
              currentYear?.data.push(newSummaryMonth(month.number));
              currentYear?.data.sort((a, b) => a.month - b.month);
              currentMonth = currentYear?.data.find((e) => e.month === month.number);
            }
            const monthCategory = month.categories.find((e) => e.category === currentCategory?.category);
            if (monthCategory) {
              currentMonth!.carbonEmissions =
                (currentMonth?.carbonEmissions || 0) + (monthCategory.carbonEmission.total || 0);
              currentMonth!.energyExpended =
                (currentMonth?.energyExpended || 0) + (monthCategory.energyExpended.total || 0);
              currentMonth!.activeUsers = (currentMonth?.activeUsers || 0) + 1;
            }
          });
        });
      });
    }
  });

  return globalSummary;
}

/**
 * Creates a new country object with the given country ID.
 *
 * @param {string} countryID - The ID of the country.
 * @return {GlobalSummaryCountry} - The newly created country object.
 */
function newCountry(countryID: string): GlobalSummaryCountry {
  return {
    countryID: countryID,
    cities: [],
  };
}

/**
 * Creates a new city object with the given city ID.
 *
 * @param {string} cityID - The ID of the city.
 * @return {GlobalSummaryCity} - The newly created city object.
 */
function newCity(cityID: string): GlobalSummaryCity {
  return {
    cityID: cityID,
    categories: [],
    users: {
      userCount: 0,
      consumptionsCount: 0,
      // recurringConsumptionsCount: undefined,
      genders: [],
    },
  };
}

/**
 * Creates a new gender object with the given gender name.
 *
 * @param {string} genderName - The name of the gender.
 * @return {GlobalSummaryDemographicCategory} - The new gender object.
 */
function newGender(genderName: string): GlobalSummaryDemographicCategory {
  return {
    demographicCategory: genderName,
    count: 0,
  };
}

/**
 * Validates the label and returns either the validated label or "unknown".
 *
 * @param {string | undefined} label - The label to be validated
 * @return {Label | "unknown"} The validated label or "unknown"
 */
function validateLabel(label: string | undefined): Label | "unknown" {
  const validLabels = ["A+", "A", "B", "C", "D", "E", "F", "G"];
  if (!label || !validLabels.includes(label)) {
    return "unknown";
  }
  return label as Label;
}

/**
 * Creates a new category label.
 *
 * @param {Label | "unknown"} label - the label for the category
 * @return {CategoryLabel} the newly created category label
 */
function newLabel(label: Label | "unknown"): CategoryLabel {
  return {
    label: label,
    carbonEmissions: 1,
    energyExpended: 1,
  };
}

/**
 * Checks if the user has any consumptions.
 *
 * @param {UserWithSubCollections} user - The user object to check.
 * @return {boolean} Returns true if the user has consumptions, false otherwise.
 */
export function hasConsumptions(user: UserWithSubCollections): boolean {
  const hasConsumptions = user.consumptions && user.consumptions.length > 0;
  return hasConsumptions || false;
}

/**
 * Creates a new consumption source object.
 *
 * @param {string} inputSource - The input source for the consumption.
 * @return {GlobalSummaryCategorySource} - The newly created consumption source object.
 */
function newConsumptionSource(inputSource: string): GlobalSummaryCategorySource {
  return {
    source: inputSource,
    carbonEmissions: 0,
    energyExpended: 0,
    value: 0,
    count: 0,
  };
}

/**
 * Creates a new consumption summary object.
 *
 * @param {ConsumptionCategory} inputCategory - The category of the consumption.
 * @return {GlobalSummaryCategory} - The new consumption summary object.
 */
function newConsumptionSummary(inputCategory: ConsumptionCategory): GlobalSummaryCategory {
  return {
    category: inputCategory,
    carbonEmissions: 0,
    energyExpended: 0,
    consumptionsCount: 0,
    // activeUsers: undefined,
    categorySource: [],
    temporal: [],
  };
}

/**
 * Checks if the user has a consumption summary.
 *
 * @param {UserWithSubCollections} user - The user object.
 * @return {boolean} - Returns true if the user has a consumption summary, otherwise false.
 */
function hasConsumptionSummary(user: UserWithSubCollections): boolean {
  const hasSummaries = user.consumptionSummaries && user.consumptionSummaries.length > 0;
  return hasSummaries || false;
}

/**
 * Ensures that a consumption summary exists for the given category in the current city.
 *
 * @param {GlobalSummaryCity} currentCity - The current city object.
 * @param {ConsumptionCategory} category - The consumption category to ensure a summary for.
 * @return {GlobalSummaryCity} - The updated city object with the consumption summary.
 */
function ensureConsumptionSummary(currentCity: GlobalSummaryCity, category: ConsumptionCategory): GlobalSummaryCity {
  const thisConsumptionSummary = currentCity.categories.find(
    (consumptionSummary) => consumptionSummary.category === category
  );

  if (!thisConsumptionSummary) {
    currentCity.categories.push(newConsumptionSummary(category));
  }

  return currentCity;
}

/**
 * Creates a new summary year object with the given current year.
 *
 * @param {string} currentYear - The current year.
 * @return {GlobalSummaryCategoryTemporalYear} - The new summary year object.
 */
function newSummaryYear(currentYear: string): GlobalSummaryCategoryTemporalYear {
  return {
    year: currentYear,
    categoryLabels: [],
    data: [],
  };
}

/**
 * Creates a new summary month object with default values for carbon emissions and energy expended.
 *
 * @param {number} currentMonth - The current month.
 * @return {GlobalSummaryCategoryTemporalMonth} - The new summary month object.
 */
function newSummaryMonth(currentMonth: number): GlobalSummaryCategoryTemporalMonth {
  return {
    month: currentMonth,
    carbonEmissions: 0,
    energyExpended: 0,
    activeUsers: 0,
  };
}

/**
 * [exportUserData]
 * A Cloud Function which is triggered by a pub/sub every day at 00:30.
 * It creates an extract of all Firestore documents within the user collection,
 * summarises the data, and uploads a JSON object to a cloud bucket.
 */
export const exportUserData = onSchedule({ schedule: "every day 00:30", timeZone: "Europe/Berlin" }, async () => {
  try {
    const usersSnapshot = await firestore.collection(FirebaseConstants.collections.users.name).get();
    const consolidatedUsers: ConsolidatedUsers = {};

    const firebaseConfig = await firestore
      .collection(FirebaseConstants.collections.exportUserDataBlacklistedUsers.name)
      .get();

    const userIdBlacklist = firebaseConfig.docs.map((doc) => doc.id);

    for (const doc of usersSnapshot.docs) {
      const userId = doc.id;
      consolidatedUsers;
      consolidatedUsers[userId] = doc.data() as UserWithSubCollections;

      // Fetch specific sub-collections
      const consumptionsSnapshot = await firestore
        .collection(FirebaseConstants.collections.users.name)
        .doc(userId)
        .collection(FirebaseConstants.collections.users.consumptions.name)
        .get();
      consolidatedUsers[userId].consumptions = consumptionsSnapshot.docs.map((doc) => doc.data() as Consumption);

      const consumptionSummariesSnapshot = await firestore
        .collection(FirebaseConstants.collections.users.name)
        .doc(userId)
        .collection(FirebaseConstants.collections.users.consumptionSummaries.name)
        .get();
      consolidatedUsers[userId].consumptionSummaries = consumptionSummariesSnapshot.docs.map(
        (doc) => doc.data() as ConsumptionSummary
      );

      // Recurring consumptions are currently not needed for the summarised export, but included in the backup
      const recurringConsumptionsSnapshot = await firestore
        .collection(FirebaseConstants.collections.users.name)
        .doc(userId)
        .collection(FirebaseConstants.collections.users.recurringConsumptions.name)
        .get();
      consolidatedUsers[userId].recurringConsumptions = recurringConsumptionsSnapshot.docs.map(
        (doc) => doc.data() as RecurringConsumption
      );
    }

    const transformedUserData = transformUserData(consolidatedUsers, userIdBlacklist);

    // Get time from transformedUserData to ensure same timestamp on export
    const currentUnixTime = transformedUserData.date;

    // Create a file in the bucket and write the transformed users data to it
    const summaryFolderName = FirebaseConstants.buckets.auroraDashboard.folders.dashboardData.name;
    const summaryFileName = `summarised-export-${currentUnixTime}.json`;
    const summaryFilePath = `${summaryFolderName}/${summaryFileName}`;

    const transformedUserDataFile = storage()
      .bucket(FirebaseConstants.buckets.auroraDashboard.name)
      .file(summaryFilePath);

    await transformedUserDataFile.save(JSON.stringify(transformedUserData)).then(() => {
      console.log(`Successfully exported summarised user data to ${summaryFilePath}`);
    });

    // Create a file in the bucket and write the full users data to it
    const backupFolderName = FirebaseConstants.buckets.default.folders.userDataBackup.name;
    const backupFileName = `users-backup-${currentUnixTime}.json`;
    const backupFilePath = `${backupFolderName}/${backupFileName}`;

    const fullUserDataFile = storage().bucket(FirebaseConstants.buckets.default.name).file(backupFilePath);
    await fullUserDataFile.save(JSON.stringify(consolidatedUsers)).then(() => {
      console.log(`Successfully exported user data to ${backupFilePath}`);
    });
  } catch (error) {
    throw new Error(`Error exporting users data: ${error}`);
  }
});
