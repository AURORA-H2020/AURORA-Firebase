import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, Timestamp, DocumentData } from "firebase-admin/firestore";
import { FirebaseConstants } from "../utils/firebase-constants";
import { Consumption } from "../models/consumption/consumption";
import { User } from "../models/user/user";
import { CountryMetric } from "../models/country/metric/country-metric";
import { ConsumptionCategory } from "../models/consumption/consumption-category";
import { ConsumptionSummary } from "../models/consumption-summary/consumption-summary";
import { CountryLabelStructure } from "../models/country/labels/country-label-structure";
import { CountryLabelValues } from "../models/country/labels/country-label-values";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

/**
 * [calculateCarbonEmissions]
 * A Cloud Function triggered by a document write in the consumptions sub-collection of a user.
 * This function will calculate the carbon emissions and write it to the corresponding property.
 */
export const calculateCarbonEmissions = onDocumentWritten(
  `${FirebaseConstants.collections.users.name}/{userId}/${FirebaseConstants.collections.users.consumptions.name}/{consumptionId}`,
  async (event) => {
    let isEdit = false;
    if (event.data?.after.exists && event.data?.before.exists) {
      // check if the user entered data hasn't changed (no edit)
      const category: ConsumptionCategory = event.data.after.data()?.category;
      if (category == "transportation") {
        if (
          JSON.stringify(event.data.after.data()?.transportation) !=
          JSON.stringify(event.data.before.data()?.transportation)
        )
          isEdit = true;
      } else {
        if (JSON.stringify(event.data.after.data()?.[category]) != JSON.stringify(event.data.before.data()?.[category]))
          isEdit = true;
      }
      if (event.data.after.data()?.value == event.data.before.data()?.value && !isEdit) {
        // check whether the energy and carbon calculated properties exist
        if (
          (event.data.after.data()?.energyExpended || event.data.after.data()?.energyExpended === 0) &&
          (event.data.after.data()?.carbonEmissions || event.data.after.data()?.carbonEmissions === 0)
        ) {
          return; // exit function without doing anything
        }
      } else if (event.data.after.data()?.value != event.data.before.data()?.value) {
        isEdit = true;
      }
    }
    // Retrieve the user from the users collection by using the "userId" parameter from the path
    const user = (
      await firestore.collection(FirebaseConstants.collections.users.name).doc(event.params.userId).get()
    ).data() as User;
    if (!user) {
      throw new Error("User not found");
    }
    // Version of this implementation of the calculateConsumption function. Increase to trigger recalculating all consumptions on next data entry.
    const latestConsumptionVersion = "1.0.1";
    // Check if consumptionVersion matches with latest, else recalculate all consumptions
    if (!user.consumptionMeta || user.consumptionMeta?.version != latestConsumptionVersion) {
      console.log(
        "Consumption version mismatch. Was: " +
          user.consumptionMeta?.version +
          " | Expected: " +
          latestConsumptionVersion +
          "  Recalculating consumptions for user: " +
          event.params.userId
      );
      await firestore
        .collection(FirebaseConstants.collections.users.name)
        .doc(event.params.userId)
        .collection(FirebaseConstants.collections.users.consumptions.name)
        .orderBy("createdAt", "desc")
        .get()
        .then((snapshot) => {
          snapshot.forEach(async (singleConsumption) => {
            try {
              const calculatedConsumptions = await calculateConsumption(singleConsumption.data() as Consumption, user, {
                userId: event.params.userId,
                consumptionId: event.params.consumptionId,
              });
              if (
                (calculatedConsumptions?.carbonEmission || calculatedConsumptions?.carbonEmission === 0) &&
                (calculatedConsumptions.energyExpended || calculatedConsumptions.energyExpended === 0)
              ) {
                singleConsumption.ref.update({
                  carbonEmissions: calculatedConsumptions.carbonEmission,
                  energyExpended: calculatedConsumptions.energyExpended,
                  version: latestConsumptionVersion,
                  updatedAt: Timestamp.fromDate(new Date()),
                });
              }
            } catch (error) {
              console.log(error);
            }
          });
        });
      // Write latest version to user after recalculating all consumptions
      await firestore
        .collection(FirebaseConstants.collections.users.name)
        .doc(event.params.userId)
        .update({
          consumptionMeta: {
            version: latestConsumptionVersion,
            lastRecalculation: Timestamp.fromDate(new Date()),
          },
        });
      // calculate Consumption Summary with updated consumptions. Passing no consumption will force recalculation based on all existing consumptions
      await calculateConsumptionSummary(user, {
        userId: event.params.userId,
        consumptionId: event.params.consumptionId,
      });
    } else {
      // Check if document still exists. No calculation necessary if it has been deleted
      if (event.data?.after.exists) {
        // Calculate carbon emissions
        const calculatedConsumptions = await calculateConsumption(event.data.after.data() as Consumption, user, {
          userId: event.params.userId,
          consumptionId: event.params.consumptionId,
        });
        // Check if carbon emissions are available
        if (
          (calculatedConsumptions?.carbonEmission || calculatedConsumptions?.carbonEmission === 0) &&
          (calculatedConsumptions.energyExpended || calculatedConsumptions.energyExpended === 0)
        ) {
          // Update consumption and set calculated carbon emissions
          await firestore
            .collection(FirebaseConstants.collections.users.name)
            .doc(event.params.userId)
            .collection(FirebaseConstants.collections.users.consumptions.name)
            .doc(event.params.consumptionId)
            .update({
              carbonEmissions: calculatedConsumptions.carbonEmission,
              energyExpended: calculatedConsumptions.energyExpended,
              version: latestConsumptionVersion,
              updatedAt: Timestamp.fromDate(new Date()),
            });
        }
        // get consumption again from firestore, as it has been updated with calculated consumptions
        const consumption = (
          await firestore
            .collection(FirebaseConstants.collections.users.name)
            .doc(event.params.userId)
            .collection(FirebaseConstants.collections.users.consumptions.name)
            .doc(event.params.consumptionId)
            .get()
        ).data();
        // check if this is an edit
        if (!isEdit) {
          // simply add the consumption if it is not an edit
          await calculateConsumptionSummary(
            user,
            { userId: event.params.userId, consumptionId: event.params.consumptionId },
            consumption as Consumption
          );
        } else {
          // TODO: Improve this so recalculation isn't required by removing the old consumption and adding the new.
          // Otherwise this is an edit and we recalculate all consumptions.
          await calculateConsumptionSummary(user, {
            userId: event.params.userId,
            consumptionId: event.params.consumptionId,
          });
        }
      } else {
        // If there is no snapshot.after, document has been deleted, hence needs to be removed from the summary
        await calculateConsumptionSummary(
          user,
          { userId: event.params.userId, consumptionId: event.params.consumptionId },
          event.data?.before.data() as Consumption,
          true
        );
      }
    }
  }
);

/**
 * Calculate carbon emissions
 * @param consumption The consumption
 * @param user The user
 * @param context The context.
 */
async function calculateConsumption(
  consumption: Consumption,
  user: User,
  context: { userId: string; consumptionId: string }
): Promise<{ carbonEmission: number; energyExpended: number } | undefined> {
  // Country to fall back to in case returned EF value is not a number
  const metricsFallbackCountry = "sPXh74wjZf14Jtmkaas6";
  // Get date of consumption: startDate for periodic consumptions and dateOfTravel for transportation
  const consumptionDate: Timestamp | undefined =
    consumption.electricity?.startDate ?? consumption.heating?.startDate ?? consumption.transportation?.dateOfTravel;
  if (!consumptionDate) {
    throw new Error("Consumption Date is missing");
  }
  // Switch on category
  switch (consumption.category) {
    case "heating": {
      const heatingData = consumption.heating;
      if (!heatingData) {
        // Log error and exit if heating data does not exist
        throw new Error(
          "Heating data does not exist on User: " + context.userId + " | Consumption: " + context.consumptionId
        );
      }
      let metrics = await getMetrics(user.country, consumptionDate);
      let heatingEF = getHeatingEF(heatingData, metrics);
      // Fallback in case heatingEF is not a Number
      if (!heatingEF) {
        metrics = await getMetrics(metricsFallbackCountry, consumptionDate);
        heatingEF = getHeatingEF(heatingData, metrics);
      }
      const consumptionData = {
        // Calculation for the carbon emission. Takes the entered kWh value, divided by the number of people in the household, times the heating emission factor.
        carbonEmission: (consumption.value / heatingData.householdSize) * heatingEF ?? undefined,
        energyExpended: consumption.value / heatingData.householdSize ?? undefined,
      };
      if (!isNaN(consumptionData.carbonEmission) && !isNaN(consumptionData.energyExpended)) return consumptionData;
      else
        throw new Error(
          "Missing carbonEmission and/or energyExpended data for user " +
            context.userId +
            " on entering consumption " +
            context.consumptionId +
            "[heating]"
        );
    }
    case "electricity": {
      const electricityData = consumption?.electricity;
      if (!electricityData) {
        // Log error and exit if electricity data does not exist
        throw new Error(
          "Electricity data does not exist on User: " + context.userId + " | Consumption: " + context.consumptionId
        );
      }
      let metrics = await getMetrics(user.country, consumptionDate);
      let electricityEF = getElectricityEF(electricityData, metrics);
      // Fallback in case electricityEF is not a Number
      if (!electricityEF) {
        metrics = await getMetrics(metricsFallbackCountry, consumptionDate);
        electricityEF = getElectricityEF(electricityData, metrics);
      }
      const consumptionData = {
        // Calculation for the carbon emission.
        // Takes the entered kWh value, divided by the number of people in the household, times the electricity emission factor.
        carbonEmission: (consumption.value / electricityData.householdSize) * electricityEF ?? undefined,
        energyExpended: consumption.value / electricityData.householdSize ?? undefined,
      };
      if (!isNaN(consumptionData.carbonEmission) && !isNaN(consumptionData.energyExpended)) {
        return consumptionData;
      } else {
        throw new Error(
          "Missing carbonEmission and/or energyExpended data for user " +
            context.userId +
            " on entering consumption " +
            context.consumptionId +
            "[electricity]"
        );
      }
    }
    case "transportation": {
      const transportationData = consumption.transportation;
      if (!transportationData) {
        // Log error and exit if transportation data does not exist
        throw new Error(
          "Transportation data does not exist on User: " + context.userId + " | Consumption: " + context.consumptionId
        );
      }
      let metrics = await getMetrics(user.country, consumptionDate);
      let transportationFactors = getTransportationEF(transportationData, metrics);
      // Fallback in case transportationEF is not a Number
      if (!transportationFactors) {
        metrics = await getMetrics(metricsFallbackCountry, consumptionDate);
        transportationFactors = getTransportationEF(transportationData, metrics);
      }
      if (
        transportationData.transportationType === "plane" &&
        transportationFactors?.carbonEF &&
        transportationFactors.energyEF
      ) {
        // Only if transportation type is "plane", return just the Emission Factor, as it is constant per capita
        return {
          carbonEmission: transportationFactors.carbonEF,
          energyExpended: transportationFactors.energyEF,
        };
      } else if (transportationFactors?.carbonEF === 0 && transportationFactors.energyEF) {
        return {
          carbonEmission: transportationFactors.carbonEF,
          energyExpended: consumption.value * transportationFactors.energyEF,
        };
      } else if (!isNaN(transportationFactors?.carbonEF) && !isNaN(transportationFactors?.energyEF)) {
        // For all other transportation types: Transport Emission Factor is in kg CO2 per km, so it is just multiplied with the value given in kilometer.
        return {
          carbonEmission: consumption.value * transportationFactors?.carbonEF,
          energyExpended: consumption.value * transportationFactors?.energyEF,
        };
      } else
        throw new Error(
          "Missing carbonEmission and/or energyExpended data for user " +
            context.userId +
            " on entering consumption " +
            context.consumptionId +
            "[transportation]"
        );
    }
  }
}

/**
 * Function to get latest heating Emission Factor for a consumption, given a metric.
 * @param heatingData Part of the consumption relevant to heating.
 * @param metrics Document Data containing all EF values (metrics).
 */
function getHeatingEF(heatingData: Consumption["heating"], metrics: DocumentData) {
  if (!heatingData) {
    throw new Error("Could not get heating metric in 'getHeatingEF'");
  }
  const heatingFuel = heatingData.heatingFuel;
  switch (heatingFuel) {
    // If the user has selected "Electric Heating", the electricity values will be used.
    case "electric": {
      return getElectricityEF(heatingData, metrics);
    }
    case "district": {
      if (heatingData.districtHeatingSource === "electric") {
        return getElectricityEF(heatingData, metrics);
      } else {
        if (heatingData.districtHeatingSource) {
          if (metrics.heating && heatingData.districtHeatingSource in metrics.heating) {
            return metrics.heating[heatingData.districtHeatingSource];
          } else {
            return undefined;
          }
        }
      }
      break;
    }
    // If consumption has any other type of heating, simply look the Emission Factor up.
    default: {
      if (metrics.heating && heatingData.heatingFuel in metrics.heating) {
        return metrics.heating[heatingData.heatingFuel];
      } else {
        return undefined;
      }
    }
  }
}

/**
 * Function to get latest electricity Emission Factor for a consumption, given a metric.
 * @param electricityData Part of the consumption relevant to electricity.
 * @param metrics Document Data containing all EF values (metrics).
 */
function getElectricityEF(electricityData: Consumption["electricity"], metrics: DocumentData) {
  if (!metrics.electricity.default) {
    throw new Error("Could not get electricity metric in 'getElectricityEF'");
  }
  return metrics.electricity.default;
}

/**
 * Function to get latest transportation Emission Factor for a consumption, given a metric.
 * @param transportationData Part of the consumption relevant to transportation.
 * @param metrics Document Data containing all EF values (metrics).
 */
function getTransportationEF(transportationData: Consumption["transportation"], metrics: DocumentData) {
  if (!transportationData) {
    throw new Error("Could not get transportation metric in 'getTransportationEF'");
  }
  const transportationType = transportationData?.transportationType;
  const publicVehicleOccupancy = transportationData?.publicVehicleOccupancy;
  if (
    publicVehicleOccupancy &&
    transportationType &&
    transportationType in metrics.transportation &&
    transportationType in metrics.transportationEnergy
  ) {
    return {
      carbonEF: metrics.transportation[transportationType][publicVehicleOccupancy],
      energyEF: metrics.transportationEnergy[transportationType][publicVehicleOccupancy],
    };
  } else {
    let privateVehicleOccupancy = transportationData.privateVehicleOccupancy;
    if (!privateVehicleOccupancy) {
      privateVehicleOccupancy = 1;
    } else if (privateVehicleOccupancy > 2) {
      if (transportationType in ["motorcycle", "electricMotorcycle"]) {
        privateVehicleOccupancy = 2;
      } else if (privateVehicleOccupancy > 5) {
        privateVehicleOccupancy = 5;
      } else {
        privateVehicleOccupancy = 1;
      }
    }
    if (transportationType in metrics.transportation && transportationType in metrics.transportationEnergy) {
      return {
        carbonEF: metrics.transportation[transportationType][String(privateVehicleOccupancy)],
        energyEF: metrics.transportationEnergy[transportationType][String(privateVehicleOccupancy)],
      };
    } else {
      return undefined;
    }
  }
}

/**
 * Function to get relevant metrics based on:
 * @param countryID ID of the associated country.
 * @param consumptionDate Timestamp of the consumption occurrence to get the most viable metric version.
 */
async function getMetrics(countryID: string, consumptionDate: Timestamp | undefined) {
  const metrics = (await firestore
    .collection(FirebaseConstants.collections.countries.name)
    .doc(countryID)
    .collection(FirebaseConstants.collections.countries.metrics.name)
    .where("validFrom", "<", consumptionDate)
    .orderBy("validFrom", "desc")
    .limit(1)
    .get()
    .then((querySnapshot) => {
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data();
      } else {
        return undefined;
      }
    })) as CountryMetric;
  if (!metrics) {
    throw new Error("Country not found");
  }
  return metrics;
}

async function calculateConsumptionSummary(
  user: User,
  context: { userId: string; consumptionId: string },
  consumption?: Consumption,
  isDelete = false
) {
  // Version of this implementation of the calculateConsumptionSummary function. Increase to trigger recalculating all entries on next data entry.
  const latestConsumptionSummaryVersion = "1.0.0";
  const countryLabels = (
    await firestore.collection(FirebaseConstants.collections.countries.name).doc(user.country).get()
  ).data()?.labels;
  if (!countryLabels) return;
  let consumptionSummaryArray: ConsumptionSummary[] | undefined = [];
  // get existing consumption summary, if any, but only if a single consumption is provided. Otherwise recalculate the summary from scratch.
  if (consumption) {
    await firestore
      .collection(FirebaseConstants.collections.users.name)
      .doc(context.userId)
      .collection(FirebaseConstants.collections.users.consumptionSummaries.name)
      .get()
      .then((snapshot) => {
        snapshot.forEach((consumptionSummaryEntry) => {
          consumptionSummaryArray?.push(consumptionSummaryEntry.data() as ConsumptionSummary);
        });
      });
  }
  if (
    latestConsumptionSummaryVersion == user.consumptionSummaryMeta?.version &&
    consumptionSummaryArray.length > 0 &&
    consumption &&
    !isXDaysAgo(user.consumptionSummaryMeta.lastRecalculation, 14)
  ) {
    consumptionSummaryArray = updateConsumptionSummaryEntries(
      consumption as Consumption,
      countryLabels,
      latestConsumptionSummaryVersion,
      consumptionSummaryArray,
      isDelete
    );
  } else {
    consumptionSummaryArray = [];
    console.log(
      "Consumption summary version mismatch or outdated. Version was: " +
        user.consumptionSummaryMeta?.version +
        " | Expected: " +
        latestConsumptionSummaryVersion +
        " Recalculating consumption summary for user: " +
        context.userId
    );
    await firestore
      .collection(FirebaseConstants.collections.users.name)
      .doc(context.userId)
      .collection(FirebaseConstants.collections.users.consumptions.name)
      .get()
      .then((snapshot) => {
        snapshot.forEach((currentConsumption) => {
          try {
            consumptionSummaryArray = updateConsumptionSummaryEntries(
              currentConsumption.data() as Consumption,
              countryLabels,
              latestConsumptionSummaryVersion,
              consumptionSummaryArray
            );
          } catch (error) {
            console.log(error);
          }
        });
      });
    if (consumptionSummaryArray.length > 0) {
      // Write latest version to user after recalculating full consumption summary
      await firestore
        .collection(FirebaseConstants.collections.users.name)
        .doc(context.userId)
        .update({
          consumptionSummaryMeta: {
            version: latestConsumptionSummaryVersion,
            lastRecalculation: Timestamp.fromDate(new Date()),
          },
        });
    }
  }
  if (consumptionSummaryArray) {
    await Promise.allSettled(
      consumptionSummaryArray.map((consumptionSummary) =>
        firestore
          .collection(FirebaseConstants.collections.users.name)
          .doc(context.userId)
          .collection(FirebaseConstants.collections.users.consumptionSummaries.name)
          .doc(String(consumptionSummary.year))
          .set(consumptionSummary)
      )
    );
  }
  // Delete all documents in consumption-summary collection not in the latest consumption summary (i.e. deleted or empty)
  const validYears = consumptionSummaryArray?.map((a) => String(a.year));
  await firestore
    .collection(FirebaseConstants.collections.users.name)
    .doc(context.userId)
    .collection(FirebaseConstants.collections.users.consumptionSummaries.name)
    .get()
    .then((querySnapshot) => {
      querySnapshot.docs.forEach((snapshot) => {
        if (!validYears?.includes(snapshot.id)) {
          snapshot.ref.delete();
        }
      });
    });
}

function newConsumptionSummaryEntry(year: number, categories: string[]) {
  const consumptionSummaryEntry: ConsumptionSummary = {
    year: year,
    version: "1.0.0",
    dateLastUpdated: Timestamp.fromDate(new Date()),
    carbonEmission: {
      total: 0,
    },
    energyExpended: {
      total: 0,
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
      },
      energyExpended: {
        total: 0,
        percentage: 0,
      },
      consumptionDays: {},
    });
  });
  return consumptionSummaryEntry;
}

function newMonthlyConsumptionSummary(month: number) {
  return {
    number: month,
    carbonEmission: {
      total: 0,
    },
    energyExpended: {
      total: 0,
    },
    categories: [],
  };
}

function newMonthlyConsumptionCategory(category: ConsumptionCategory) {
  return {
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
}

function updateConsumptionSummaryEntries(
  consumption: Consumption,
  labelStructure: CountryLabelStructure,
  currentVersion: string,
  consumptionSummaryEntries?: ConsumptionSummary[],
  isDelete = false
): ConsumptionSummary[] | undefined {
  const categories: ConsumptionCategory[] = ["heating", "electricity", "transportation"];
  // get carbonEmissionValue and energyExpendedValue from current consumption
  let carbonEmissionValue = consumption.carbonEmissions;
  let energyExpendedValue = consumption.energyExpended;
  // Only proceed if both values are not undefined
  if ((carbonEmissionValue || carbonEmissionValue === 0) && (energyExpendedValue || energyExpendedValue === 0)) {
    // reverse values if this is a delete action
    if (isDelete) {
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
        "Monthly Distribution undefined. monthlyCarbonEmissionDistribution: " +
          JSON.stringify(monthlyCarbonEmissionDistribution) +
          " monthlyEnergyExpendedDistribution: " +
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
      let thisCarbonEmissionAnnualTotal = 0;
      let thisEnergyExpendedAnnualTotal = 0;
      annualConsumption.version = currentVersion;
      annualConsumption.dateLastUpdated = Timestamp.fromDate(new Date());
      Object.entries(monthlyCarbonEmissionDistribution[year]).forEach((monthEntry) => {
        const month = Number(monthEntry[0]);
        // create month if it does not exist
        if (!annualConsumption.months.some((e) => e.number == month)) {
          annualConsumption.months.push(newMonthlyConsumptionSummary(month));
        }
        const monthlyConsumption = ensure(annualConsumption.months.find((e) => e.number === month));
        // increase monthly consumption total
        monthlyConsumption.carbonEmission.total = normaliseNumbers(
          monthlyConsumption.carbonEmission.total + monthlyCarbonEmissionDistribution[year][month],
          "number"
        );
        monthlyConsumption.energyExpended.total = normaliseNumbers(
          monthlyConsumption.energyExpended.total + monthlyEnergyExpendedDistribution[year][month],
          "number"
        );
        // loop over categories and update them accordingly. This is required for updating percentages in all categories
        categories.forEach((category) => {
          if (!monthlyConsumption.categories.some((e) => e.category == category)) {
            monthlyConsumption.categories.push(newMonthlyConsumptionCategory(category));
          }
          const monthlyCategoryConsumption = ensure(monthlyConsumption.categories.find((e) => e.category === category));
          // only add consumption value if category matches
          if (category === consumption.category) {
            monthlyCategoryConsumption.carbonEmission.total = normaliseNumbers(
              monthlyCategoryConsumption.carbonEmission.total + monthlyCarbonEmissionDistribution[year][month],
              "number"
            );
            monthlyCategoryConsumption.energyExpended.total = normaliseNumbers(
              monthlyCategoryConsumption.energyExpended.total + monthlyEnergyExpendedDistribution[year][month],
              "number"
            );
            // add consumption value to overall total
            annualConsumption.carbonEmission.total = normaliseNumbers(
              annualConsumption.carbonEmission.total + monthlyCarbonEmissionDistribution[year][month],
              "number"
            );
            thisCarbonEmissionAnnualTotal += monthlyCarbonEmissionDistribution[year][month];
            annualConsumption.energyExpended.total = normaliseNumbers(
              annualConsumption.energyExpended.total + monthlyEnergyExpendedDistribution[year][month],
              "number"
            );
            thisEnergyExpendedAnnualTotal += monthlyEnergyExpendedDistribution[year][month];
          }
          // recalculate percentages or set to zero if totals are zero (result is NaN)
          monthlyCategoryConsumption.carbonEmission.percentage =
            normaliseNumbers(
              monthlyCategoryConsumption.carbonEmission.total / monthlyConsumption.carbonEmission.total,
              "percentage"
            ) || 0;

          monthlyCategoryConsumption.energyExpended.percentage =
            normaliseNumbers(
              monthlyCategoryConsumption.energyExpended.total / monthlyConsumption.energyExpended.total,
              "percentage"
            ) || 0;
        });
      });
      // iterate over consumption summary categories to update value of given consumption category and percentages for all
      annualConsumption.categories.forEach((categorySummary) => {
        if (categorySummary.category === consumption.category) {
          categorySummary.carbonEmission.total = normaliseNumbers(
            categorySummary.carbonEmission.total + thisCarbonEmissionAnnualTotal,
            "number"
          );
          categorySummary.energyExpended.total = normaliseNumbers(
            categorySummary.energyExpended.total + thisEnergyExpendedAnnualTotal,
            "number"
          );
          // create array with count of consumptions per day over a year
          categorySummary.consumptionDays = consumptionDaysArray(
            startDate,
            endDate,
            year,
            categorySummary.consumptionDays,
            isDelete
          );
        }
        categorySummary.carbonEmission.percentage =
          normaliseNumbers(
            categorySummary.carbonEmission.total / annualConsumption.carbonEmission.total,
            "percentage"
          ) || 0;
        categorySummary.energyExpended.percentage =
          normaliseNumbers(
            categorySummary.energyExpended.total / annualConsumption.energyExpended.total,
            "percentage"
          ) || 0;
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

function normaliseNumbers(number: number, type: "percentage" | "number") {
  const considerAsZero = 0.000001;
  switch (type) {
    case "percentage": {
      if (number > 1) {
        return 1;
      } else if (number < considerAsZero) {
        return 0;
      } else {
        return number;
      }
    }
    case "number": {
      if (number < considerAsZero) {
        return 0;
      } else {
        return number;
      }
    }
  }
}

function calculateConsumptionLabel(
  labelStructure: CountryLabelStructure,
  consumptionSummaryEntries?: ConsumptionSummary[]
) {
  if (!consumptionSummaryEntries) {
    throw new Error("consumptionSummaryEntries is undefined: " + JSON.stringify(consumptionSummaryEntries));
  }
  consumptionSummaryEntries.forEach((consumptionSummaryEntry) => {
    const overallCarbonEmissionLabels: CountryLabelValues[] = [];
    const overallEnergyExpendedLabels: CountryLabelValues[] = [];
    consumptionSummaryEntry.categories.forEach((categorySummary) => {
      const carbonEmissionCategoryLabels: CountryLabelValues[] = JSON.parse(
        JSON.stringify(
          labelStructure.carbonEmission[categorySummary.category as keyof typeof labelStructure.carbonEmission]
        )
      );
      const energyExpendedCategoryLabels: CountryLabelValues[] = JSON.parse(
        JSON.stringify(
          labelStructure.energyExpended[categorySummary.category as keyof typeof labelStructure.energyExpended]
        )
      );
      if (!carbonEmissionCategoryLabels || !energyExpendedCategoryLabels) {
        throw new Error(
          "Category Labels undefined. carbonEmissionCategoryLabels: " +
            JSON.stringify(carbonEmissionCategoryLabels) +
            " energyExpendedCategoryLabels: " +
            JSON.stringify(energyExpendedCategoryLabels)
        );
      }
      // get factor of consumptions entered based on number of days of data entry
      let consumptionDaysCount = 0;
      for (const day in categorySummary.consumptionDays) {
        if (categorySummary.consumptionDays[day] > 0) consumptionDaysCount += 1;
      }
      let consumptionLabelFactor: number;
      // Set consumptionLabelFactor to fraction of 1 for transportation, as it cannot be prorated across the year like the other categories, up to 5 entries.
      if (categorySummary.category == "transportation") {
        if (consumptionDaysCount <= 5) {
          consumptionLabelFactor = consumptionDaysCount / 5;
        } else {
          consumptionLabelFactor = 1;
        }
      } else {
        consumptionLabelFactor = consumptionDaysCount / Object.keys(categorySummary.consumptionDays).length;
      }
      if (!consumptionLabelFactor) {
        consumptionLabelFactor = 0;
      }
      // adjust labelValues based on first consumption date and current day
      carbonEmissionCategoryLabels.map((singleCarbonEmissionLabel) => {
        singleCarbonEmissionLabel.maximum *= consumptionLabelFactor;
        singleCarbonEmissionLabel.minimum *= consumptionLabelFactor;
      });
      energyExpendedCategoryLabels.map((singleEnergyExpendedLabel) => {
        singleEnergyExpendedLabel.maximum *= consumptionLabelFactor;
        singleEnergyExpendedLabel.minimum *= consumptionLabelFactor;
      });
      let foundCarbonEmissionLabel = false;
      carbonEmissionCategoryLabels.forEach((carbonEmissionLabel) => {
        if (
          carbonEmissionLabel.maximum > categorySummary.carbonEmission.total &&
          carbonEmissionLabel.minimum <= categorySummary.carbonEmission.total &&
          consumptionDaysCount > 0
        ) {
          categorySummary.carbonEmission.label = carbonEmissionLabel.label;
          foundCarbonEmissionLabel = true;
        } else if (!foundCarbonEmissionLabel) {
          categorySummary.carbonEmission.label = undefined;
        }
        // construct overall Carbon Emission label
        const i = overallCarbonEmissionLabels.findIndex(
          (overallCarbonEmissionLabel) => overallCarbonEmissionLabel.label === carbonEmissionLabel.label
        );
        if (i > -1) {
          overallCarbonEmissionLabels[i].maximum += carbonEmissionLabel.maximum;
          overallCarbonEmissionLabels[i].minimum += carbonEmissionLabel.minimum;
        } else {
          overallCarbonEmissionLabels.push({ ...carbonEmissionLabel });
        }
      });
      let foundEnergyExpendedLabel = false;
      energyExpendedCategoryLabels.forEach((energyExpendedLabel) => {
        if (
          energyExpendedLabel.maximum > categorySummary.energyExpended.total &&
          energyExpendedLabel.minimum <= categorySummary.energyExpended.total &&
          consumptionDaysCount > 0
        ) {
          categorySummary.energyExpended.label = energyExpendedLabel.label;
          foundEnergyExpendedLabel = true;
        } else if (!foundEnergyExpendedLabel) {
          categorySummary.energyExpended.label = undefined;
        }
        // construct overall Energy Expended label
        const i = overallEnergyExpendedLabels.findIndex(
          (overallEnergyExpendedLabel) => overallEnergyExpendedLabel.label === energyExpendedLabel.label
        );
        if (i > -1) {
          overallEnergyExpendedLabels[i].maximum += energyExpendedLabel.maximum;
          overallEnergyExpendedLabels[i].minimum += energyExpendedLabel.minimum;
        } else {
          overallEnergyExpendedLabels.push({ ...energyExpendedLabel });
        }
      });
    });
    // find label for overall annual consumption
    if (consumptionSummaryEntry.categories.filter((e) => e.carbonEmission.label).length > 0) {
      overallCarbonEmissionLabels.forEach((overallCarbonEmissionLabel) => {
        if (
          overallCarbonEmissionLabel.maximum > consumptionSummaryEntry.carbonEmission.total &&
          overallCarbonEmissionLabel.minimum < consumptionSummaryEntry.carbonEmission.total
        ) {
          consumptionSummaryEntry.carbonEmission.label = overallCarbonEmissionLabel.label;
        }
      });
    } else {
      consumptionSummaryEntry.carbonEmission.label = undefined;
    }
    if (consumptionSummaryEntry.categories.filter((e) => e.energyExpended.label).length > 0) {
      overallEnergyExpendedLabels.forEach((overallEnergyExpendedLabel) => {
        if (
          overallEnergyExpendedLabel.maximum > consumptionSummaryEntry.energyExpended.total &&
          overallEnergyExpendedLabel.minimum < consumptionSummaryEntry.energyExpended.total
        ) {
          consumptionSummaryEntry.energyExpended.label = overallEnergyExpendedLabel.label;
        }
      });
    } else {
      consumptionSummaryEntry.energyExpended.label = undefined;
    }
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
  isDelete = false
): { [day: number]: number } {
  let startDate = new Date(startDateTimestamp.seconds * 1000);
  let endDate = new Date(endDateTimestamp.seconds * 1000);
  startDate = new Date(startDate.setUTCHours(0, 0, 0, 0));
  endDate = new Date(endDate.setUTCHours(0, 0, 0, 0));
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  let countValue = 1;
  if (isDelete) countValue *= -1;
  if (!arr) {
    arr = {};
  }
  for (let year = startYear; year <= endYear; year++) {
    if (year != forYear) continue;
    let yearStart = new Date(year, 0, 1, 1);
    yearStart = new Date(yearStart.setUTCHours(0, 0, 0, 0));
    let yearEnd = new Date(year + 1, 0, 1, 1);
    yearEnd = new Date(yearEnd.setUTCHours(0, 0, 0, 0));
    const yearLength = Math.ceil((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
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

function isXDaysAgo(date: Timestamp | undefined, thresholdDays: number): boolean {
  if (date) {
    const currentTime = new Date();
    const dateToCheck = new Date(date.seconds * 1000);
    const diffDays = Math.abs(currentTime.getTime() - dateToCheck.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > thresholdDays;
  } else {
    return true;
  }
}
