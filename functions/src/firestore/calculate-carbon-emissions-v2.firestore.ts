import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import { DocumentSnapshot, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { FirebaseConstants } from "../utils/firebase-constants";
import { User } from "../models/user/user";
import { Consumption } from "../models/consumption/consumption";
import { CountryMetric } from "../models/country/metric/country-metric";
import { ConsumptionHeating } from "../models/consumption/heating/consumption-heating";
import { ConsumptionElectricity } from "../models/consumption/electricity/consumption-electricity";
import { ConsumptionTransportation } from "../models/consumption/transportation/consumption-transportation";
import { ConsumptionCategory } from "../models/consumption/consumption-category";
import { Country } from "../models/country/country";
import { ConsumptionSummary } from "../models/consumption-summary/consumption-summary";
import { CountryLabelStructure } from "../models/country/labels/country-label-structure";
import { CountryLabelValues } from "../models/country/labels/country-label-values";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

// The latest consumption version
const latestConsumptionVersion = "1.0.1";

// The latest consumption summary version
const latestConsumptionSummaryVersion = "1.0.0";

// Country to fall back to in case returned EF value is not a number
const metricsFallbackCountry = "sPXh74wjZf14Jtmkaas6";

/**
 * The EventParameters
 */
interface EventContext {
  userId: string;
  consumptionId: string;
  user: User;
}

/**
 * [calculateCarbonEmissionsV2]
 * A Cloud Function triggered by a document write in the consumptions sub-collection of a user.
 * This function will calculate the carbon emissions and write it to the corresponding property.
 */
export const calculateCarbonEmissionsV2 = onDocumentWritten(
  `${FirebaseConstants.collections.users.name}/{userId}/${FirebaseConstants.collections.users.consumptions.name}/{consumptionId}`,
  async (event) => {
    // Check if user id does not match "Lars Lorenz" Account
    // TODO: Remove this debug check when removing `calculateCarbonEmissions` cloud function
    if (event.params.userId !== "uw6h1wRVOvbEg4xKW2lx6nFqueA3") {
      // Return out of function
      return;
    }
    // Determine the consumption change event
    const consumptionChangeEvent = determineConsumptionChangeEvent(
      event.data?.before as DocumentSnapshot<Consumption> | undefined,
      event.data?.after as DocumentSnapshot<Consumption> | undefined
    );
    // Check if event status is reinvocation
    if (consumptionChangeEvent === ConsumptionChangeEvent.reinvocation) {
      // Return out of function has status is set to reinvocation
      // saying that the function was called as this function updates the consumption
      return;
    }
    console.log("Calculating carbon emissions", event.document, consumptionChangeEvent);
    // Retrieve the user from the users collection by using the "userId" parameter from the path
    const user = (
      await firestore.collection(FirebaseConstants.collections.users.name).doc(event.params.userId).get()
    ).data() as User;
    // Check if user is unavailable
    if (!user) {
      throw new Error(`User not found: ${event.params.userId}`);
    }
    // Initialize event context
    const context: EventContext = {
      userId: event.params.userId,
      consumptionId: event.params.consumptionId,
      user: user,
    };
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
      // Update all consumptions
      await updateAllConsumptions(context);
      // Update Consumption Summary
      // Passing no consumption will force recalculation based on all existing consumptions
      await updateConsumptionSummary(context);
    } else {
      // Retrieve consumption from event
      const consumption = event.data?.after.data() as Consumption | undefined;
      // Check if consumption exists
      if (consumption && event.data?.after.exists) {
        // Update consumption
        const consumptionEmissionsResult = await updateConsumption(consumption, context);
        // Check event status is edited
        if (consumptionChangeEvent === ConsumptionChangeEvent.edited) {
          // TODO: Improve this so recalculation isn't required by removing the old consumption and adding the new.
          // Recalculate all consumptions.
          await updateConsumptionSummary(context);
        } else {
          // Update consumption
          consumption.carbonEmissions = consumptionEmissionsResult.carbonEmission;
          consumption.energyExpended = consumptionEmissionsResult.energyExpended;
          consumption.version = latestConsumptionVersion;
          consumption.updatedAt = Timestamp.now();
          // Update consumption summary
          await updateConsumptionSummary(context, consumption);
        }
      } else {
        // Otherwise the consumption has been deleted, so we update the summary to remove it.
        await updateConsumptionSummary(context, event.data?.before.data() as Consumption, true);
      }
    }
  }
);

/**
 * Consumption change event
 */
enum ConsumptionChangeEvent {
  /**
   * Created consumption.
   */
  created = "created",
  /**
   * Updated consumption.
   * No important fields have been updated
   * which would cause the need of a recalculation
   */
  updated = "updated",
  /**
   * Edited consumption.
   * Important fields have been updated
   * which should result in a recalculation
   */
  edited = "edited",
  /**
   * Reinvocation
   * Nothing has changed
   */
  reinvocation = "reinvocation",
  /**
   * Deleted consumption.
   */
  deleted = "deleted",
}

/**
 * Determine consumption change event
 * @param before The before consumption document snapshot
 * @param after The after consumption document snapshot
 */
function determineConsumptionChangeEvent(
  before?: DocumentSnapshot<Consumption>,
  after?: DocumentSnapshot<Consumption>
): ConsumptionChangeEvent {
  if (before && before.exists && after && after.exists) {
    let event: ConsumptionChangeEvent = ConsumptionChangeEvent.updated;
    const category: ConsumptionCategory | undefined = after.data()?.category;
    if (category == "transportation") {
      if (JSON.stringify(after.data()?.transportation) != JSON.stringify(before.data()?.transportation)) {
        event = ConsumptionChangeEvent.edited;
      }
    } else if (category && JSON.stringify(after.data()?.[category]) != JSON.stringify(before.data()?.[category])) {
      event = ConsumptionChangeEvent.edited;
    }
    if (after.data()?.value == before.data()?.value && event !== ConsumptionChangeEvent.edited) {
      if (
        (after.data()?.energyExpended || after.data()?.energyExpended === 0) &&
        (after.data()?.carbonEmissions || after.data()?.carbonEmissions === 0)
      ) {
        event = ConsumptionChangeEvent.reinvocation;
      }
    } else if (after.data()?.value !== before.data()?.value) {
      event = ConsumptionChangeEvent.edited;
    }
    return event;
  } else if (after && after.exists && before?.exists === false) {
    return ConsumptionChangeEvent.created;
  } else {
    return ConsumptionChangeEvent.deleted;
  }
}

/**
 * Update all consumption
 * @param context The event context
 */
async function updateAllConsumptions(context: EventContext) {
  // Retrieve consumptions snapshot
  const consumptionsSnapshot = await firestore
    .collection(FirebaseConstants.collections.users.name)
    .doc(context.userId)
    .collection(FirebaseConstants.collections.users.consumptions.name)
    .orderBy("createdAt", "desc")
    .get();
  // Update all consumption documents
  await Promise.allSettled(
    consumptionsSnapshot.docs.map((consumptionDocument) =>
      updateConsumption(consumptionDocument.data() as Consumption, {
        userId: context.userId,
        consumptionId: consumptionDocument.id,
        user: context.user,
      })
    )
  );
  // Write latest version to user after recalculating all consumptions
  await firestore
    .collection(FirebaseConstants.collections.users.name)
    .doc(context.userId)
    .update({
      consumptionMeta: {
        version: latestConsumptionVersion,
        lastRecalculation: Timestamp.now(),
      },
    });
}

/**
 * Update a consumption
 * @param consumption The consumption
 * @param context The event context
 */
async function updateConsumption(
  consumption: Consumption,
  context: EventContext
): Promise<CalculateConsumptionEmissionsResult> {
  // Calculate consumption emission result
  const consumptionEmissionsResult = await calculateConsumptionEmissions(consumption, context);
  // Update consumption and set calculated carbon emissions
  await firestore
    .collection(FirebaseConstants.collections.users.name)
    .doc(context.userId)
    .collection(FirebaseConstants.collections.users.consumptions.name)
    .doc(context.consumptionId)
    .update({
      carbonEmissions: consumptionEmissionsResult.carbonEmission,
      energyExpended: consumptionEmissionsResult.energyExpended,
      version: latestConsumptionVersion,
      updatedAt: Timestamp.now(),
    });
  return consumptionEmissionsResult;
}

/**
 * Calculate consumption emissions result
 */
interface CalculateConsumptionEmissionsResult {
  /**
   * The carbon emission
   */
  carbonEmission: number;
  /**
   * The expended energy
   */
  energyExpended: number;
}

/**
 * Calculate consumption emissions context
 */
interface CalculateConsumptionEmissionsContext extends EventContext {
  /**
   * The consumption
   */
  consumption: Consumption;
  /**
   * The consumption date
   */
  consumptionDate: Timestamp;
}

/**
 * Calculate consumption emissions
 * @param consumption The consumption
 * @param context The event context
 */
async function calculateConsumptionEmissions(
  consumption: Consumption,
  context: EventContext
): Promise<CalculateConsumptionEmissionsResult> {
  // Get date of consumption: startDate for periodic consumptions and dateOfTravel for transportation
  const consumptionDate: Timestamp | undefined =
    consumption.electricity?.startDate ?? consumption.heating?.startDate ?? consumption.transportation?.dateOfTravel;
  // Check if date of consumption is unavailable
  if (!consumptionDate) {
    // Throw an error
    throw new Error("Consumption Date is missing");
  }
  // Initialize calculation context
  const calculationContext: CalculateConsumptionEmissionsContext = {
    ...context,
    consumption: consumption,
    consumptionDate: consumptionDate,
  };
  // Declare result
  let result: CalculateConsumptionEmissionsResult;
  // Switch on category
  switch (consumption.category) {
    case "heating":
      const heating = consumption.heating;
      if (!heating) {
        throw new Error("Missing heating data for a consumption with category set to heating");
      }
      result = await calculateHeatingConsumptionEmissions(heating, calculationContext);
      break;
    case "electricity":
      const electricity = consumption.electricity;
      if (!electricity) {
        throw new Error("Missing electricity data for a consumption with category set to electricity");
      }
      result = await calculateElectricityConsumptionEmissions(electricity, calculationContext);
      break;
    case "transportation":
      const transportation = consumption.transportation;
      if (!transportation) {
        throw new Error("Missing transportation data for a consumption with category set to transportation");
      }
      result = await calculateTransportationConsumptionEmissions(transportation, calculationContext);
      break;
    default:
      throw new Error(`Unsupported category: ${consumption.category}`);
  }
  if (isNaN(result.carbonEmission)) {
    throw new Error("CalculateConsumptionEmissionsResult: carbonEmission is not a number");
  }
  if (isNaN(result.energyExpended)) {
    throw new Error("CalculateConsumptionEmissionsResult: energyExpended is not a number");
  }
  return result;
}

/**
 * Calculate heating consumption emissions
 * @param heating The consumption heating data
 * @param context The calculation context
 */
async function calculateHeatingConsumptionEmissions(
  heating: ConsumptionHeating,
  context: CalculateConsumptionEmissionsContext
): Promise<CalculateConsumptionEmissionsResult> {
  const heatingEmissionFactor = await getCountryMetricValue(context.consumptionDate, context.user.country, (metric) => {
    switch (heating.heatingFuel) {
      case "electric": {
        // If the user has selected "Electric Heating", the electricity values will be used.
        return metric.electricity.default;
      }
      case "district": {
        if (heating.districtHeatingSource === "electric") {
          return metric.electricity.default;
        } else if (heating.districtHeatingSource && metric.heating && heating.districtHeatingSource in metric.heating) {
          return metric.heating[heating.districtHeatingSource];
        } else {
          return undefined;
        }
      }
      // If consumption has any other type of heating, simply look the Emission Factor up.
      default: {
        if (metric.heating && heating.heatingFuel in metric.heating) {
          return metric.heating[heating.heatingFuel];
        } else {
          return undefined;
        }
      }
    }
  });
  const householdSize = heating.householdSize ?? 1;
  return {
    carbonEmission: (context.consumption.value / householdSize) * heatingEmissionFactor,
    energyExpended: context.consumption.value / householdSize,
  };
}

/**
 * Calculate electricity consumption emissions
 * @param electricity The consumption electricity data
 * @param context The calculation context
 */
async function calculateElectricityConsumptionEmissions(
  electricity: ConsumptionElectricity,
  context: CalculateConsumptionEmissionsContext
): Promise<CalculateConsumptionEmissionsResult> {
  const electricityEmissionFactor = await getCountryMetricValue(
    context.consumptionDate,
    context.user.country,
    (metric) => metric.electricity.default
  );
  const householdSize = electricity.householdSize ?? 1;
  return {
    carbonEmission: (context.consumption.value / householdSize) * electricityEmissionFactor,
    energyExpended: context.consumption.value / householdSize,
  };
}

/**
 * Calculate transportation consumption emissions
 * @param transportation The consumption transportation data
 * @param context The calculation context
 */
async function calculateTransportationConsumptionEmissions(
  transportation: ConsumptionTransportation,
  context: CalculateConsumptionEmissionsContext
): Promise<CalculateConsumptionEmissionsResult> {
  const transportationEmissionsFactor = await getCountryMetricValue(
    context.consumptionDate,
    context.user.country,
    (metric) => {
      const transportationType = transportation.transportationType;
      const publicVehicleOccupancy = transportation.publicVehicleOccupancy;
      if (
        publicVehicleOccupancy &&
        transportationType &&
        transportationType in metric.transportation &&
        transportationType in metric.transportationEnergy
      ) {
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          carbon: (metric.transportation as any)[transportationType][publicVehicleOccupancy],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          energy: (metric.transportationEnergy as any)[transportationType][publicVehicleOccupancy],
        };
      } else {
        let privateVehicleOccupancy = transportation.privateVehicleOccupancy;
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
        if (transportationType in metric.transportation && transportationType in metric.transportationEnergy) {
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            carbon: (metric.transportation as any)[transportationType][String(privateVehicleOccupancy)],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            energy: (metric.transportationEnergy as any)[transportationType][String(privateVehicleOccupancy)],
          };
        } else {
          return undefined;
        }
      }
    }
  );
  if (transportation.transportationType === "plane") {
    // Only if transportation type is "plane", return just the Emission Factor, as it is constant
    return {
      carbonEmission: transportationEmissionsFactor.carbon,
      energyExpended: transportationEmissionsFactor.energy,
    };
  } else {
    // For all other transportation types: Transport Emission Factor is in kg CO2 per km,
    // so it is just multiplied with the value given in kilometer.
    return {
      carbonEmission: context.consumption.value * transportationEmissionsFactor.carbon,
      energyExpended: context.consumption.value * transportationEmissionsFactor.energy,
    };
  }
}

/**
 * Retrieve a country metric value
 * @param date The date
 * @param countryId The country identifier
 * @param metric A function returning a metric value
 */
async function getCountryMetricValue<Value>(
  date: Timestamp,
  countryId: string,
  metric: (countryMetric: CountryMetric) => Value | undefined
): Promise<NonNullable<Value>> {
  // Retrieve the latest country metric document
  const countryMetricDocument = (
    await firestore
      .collection(FirebaseConstants.collections.countries.name)
      .doc(countryId)
      .collection(FirebaseConstants.collections.countries.metrics.name)
      .where("validFrom", "<", date)
      .orderBy("validFrom", "desc")
      .limit(1)
      .get()
  ).docs.at(0);
  // Check if document is unavailable
  if (!countryMetricDocument || !countryMetricDocument.exists) {
    // Throw an error
    throw new Error(`Couldn't find a matching metric document for country: ${countryId}`);
  }
  // Retrieve country metric from document
  const countryMetric = countryMetricDocument.data() as CountryMetric | undefined;
  // Check if metric is unavailable
  if (!countryMetric) {
    // Throw an error
    throw new Error(`CountryMetric is unavailable for document: ${countryMetricDocument.ref.path}`);
  }
  // Retrieve value from metric
  const value = metric(countryMetric);
  // Check if value is available
  if (value) {
    // Value is available
    return value;
  } else {
    // Check if the country identifier is equal to the metrics fallback country
    if (countryId === metricsFallbackCountry) {
      // Throw an error
      throw new Error("Metric couldn't be determined");
    } else {
      // Otherwise re-invoke function with metrics fallback country
      return await getCountryMetricValue(date, metricsFallbackCountry, metric);
    }
  }
}

/**
 * Update consumption summary
 * @param context The event context
 * @param consumption The consumption
 * @param isConsumptionDeleted Bool value if the provided consumption has been deleted
 */
async function updateConsumptionSummary(
  context: EventContext,
  consumption?: Consumption,
  isConsumptionDeleted = false
) {
  const countryLabels = (
    (
      await firestore.collection(FirebaseConstants.collections.countries.name).doc(context.user.country).get()
    ).data() as Country | undefined
  )?.labels;
  if (!countryLabels) {
    return;
  }
  let consumptionSummaries: ConsumptionSummary[] = [];
  if (consumption) {
    consumptionSummaries = (
      await firestore
        .collection(FirebaseConstants.collections.users.name)
        .doc(context.userId)
        .collection(FirebaseConstants.collections.users.consumptionSummaries.name)
        .get()
    ).docs.map((document) => document.data() as ConsumptionSummary);
  }
  if (
    latestConsumptionSummaryVersion == context.user.consumptionSummaryMeta?.version &&
    consumptionSummaries.length > 0 &&
    consumption &&
    !isXDaysAgo(context.user.consumptionSummaryMeta?.lastRecalculation, 14)
  ) {
    consumptionSummaries = updateConsumptionSummaryEntries(
      consumption as Consumption,
      countryLabels,
      consumptionSummaries,
      isConsumptionDeleted
    );
  } else {
    consumptionSummaries = [];
    console.log(
      "Consumption summary version mismatch or outdated. Version was: " +
        context.user.consumptionSummaryMeta?.version +
        " | Expected: " +
        latestConsumptionSummaryVersion +
        " Recalculating consumption summary for user: " +
        context.userId
    );
    const existingConsumptions = (
      await firestore
        .collection(FirebaseConstants.collections.users.name)
        .doc(context.userId)
        .collection(FirebaseConstants.collections.users.consumptions.name)
        .get()
    ).docs.map((document) => document.data() as Consumption);
    for (const existingConsumption of existingConsumptions) {
      try {
        consumptionSummaries = updateConsumptionSummaryEntries(
          existingConsumption,
          countryLabels,
          consumptionSummaries
        );
      } catch (error) {
        console.log(error);
      }
    }
    if (consumptionSummaries.length > 0) {
      // Write latest version to user after recalculating full consumption summary
      await firestore
        .collection(FirebaseConstants.collections.users.name)
        .doc(context.userId)
        .update({
          consumptionSummaryMeta: {
            version: latestConsumptionSummaryVersion,
            lastRecalculation: Timestamp.now(),
          },
        });
    }
  }
  if (consumptionSummaries) {
    await Promise.allSettled(
      consumptionSummaries.map((consumptionSummary) =>
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
  const validYears = consumptionSummaries.map((summary) => String(summary.year));
  const consumptionSummariesSnapshot = await firestore
    .collection(FirebaseConstants.collections.users.name)
    .doc(context.userId)
    .collection(FirebaseConstants.collections.users.consumptionSummaries.name)
    .get();
  await Promise.allSettled(
    consumptionSummariesSnapshot.docs
      .filter((document) => !validYears.includes(document.id))
      .map((document) => document.ref.delete())
  );
}

/**
 * Retrieve a bool value if a given date is greater than a given threshold in days
 * @param date The date
 * @param thresholdDays The threshold in days
 */
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

/**
 * Update consumption summary entries
 * @param consumption The consumption
 * @param labelStructure The country label structure
 * @param consumptionSummaries The consumption summaries
 * @param isConsumptionDeleted Bool value if consumption has been deleted
 */
function updateConsumptionSummaryEntries(
  consumption: Consumption,
  labelStructure: CountryLabelStructure,
  consumptionSummaries: ConsumptionSummary[],
  isConsumptionDeleted = false
): ConsumptionSummary[] {
  const categories: ConsumptionCategory[] = ["heating", "electricity", "transportation"];
  // get carbonEmissionValue and energyExpendedValue from current consumption
  let carbonEmissionValue = consumption.carbonEmissions;
  let energyExpendedValue = consumption.energyExpended;
  // Only proceed if both values are not undefined
  if (!((carbonEmissionValue || carbonEmissionValue === 0) && (energyExpendedValue || energyExpendedValue === 0))) {
    throw new Error(
      "Carbon Emission and/or Energy Expended do not exist on consumption:" + JSON.stringify(consumption)
    );
  }
  // reverse values if this is a delete action
  if (isConsumptionDeleted) {
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
  for (const yearEntry of Object.entries(monthlyCarbonEmissionDistribution)) {
    const year = Number(yearEntry[0]);
    // create consumption summary if it does not exist
    if (!consumptionSummaries) {
      consumptionSummaries = [newConsumptionSummary(year, categories)];
    }
    // create year if it does not exist
    if (!consumptionSummaries.some((summary) => summary.year == year)) {
      consumptionSummaries.push(newConsumptionSummary(year, categories));
    }
    const annualConsumption = ensure(consumptionSummaries.find((summary) => summary.year === year));
    let thisCarbonEmissionAnnualTotal = 0;
    let thisEnergyExpendedAnnualTotal = 0;
    annualConsumption.version = latestConsumptionSummaryVersion;
    annualConsumption.dateLastUpdated = Timestamp.now();
    for (const [key] of Object.entries(monthlyCarbonEmissionDistribution[year])) {
      const month = Number(key);
      // create month if it does not exist
      if (!annualConsumption.months.some((annualConsumptionMonth) => annualConsumptionMonth.number === month)) {
        annualConsumption.months.push({
          number: month,
          carbonEmission: {
            total: 0,
          },
          energyExpended: {
            total: 0,
          },
          categories: [],
        });
      }
      const monthlyConsumption = ensure(
        annualConsumption.months.find((annualConsumptionMonth) => annualConsumptionMonth.number === month)
      );
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
      for (const category of categories) {
        if (
          !monthlyConsumption.categories.some(
            (monthlyConsumptionCategory) => monthlyConsumptionCategory.category == category
          )
        ) {
          monthlyConsumption.categories.push({
            category: category,
            carbonEmission: {
              total: 0,
              percentage: 0,
            },
            energyExpended: {
              total: 0,
              percentage: 0,
            },
          });
        }
        const monthlyCategoryConsumption = ensure(
          monthlyConsumption.categories.find(
            (monthlyConsumptionCategory) => monthlyConsumptionCategory.category === category
          )
        );
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
      }
    }
    // iterate over consumption summary categories to update value of given consumption category and percentages for all
    for (const categorySummary of annualConsumption.categories) {
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
          isConsumptionDeleted
        );
      }
      categorySummary.carbonEmission.percentage =
        normaliseNumbers(categorySummary.carbonEmission.total / annualConsumption.carbonEmission.total, "percentage") ||
        0;
      categorySummary.energyExpended.percentage =
        normaliseNumbers(categorySummary.energyExpended.total / annualConsumption.energyExpended.total, "percentage") ||
        0;
    }
  }
  calculateConsumptionLabel(labelStructure, consumptionSummaries);
  return consumptionSummaries;
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
  for (const consumptionSummaryEntry of consumptionSummaryEntries) {
    const overallCarbonEmissionLabels: CountryLabelValues[] = [];
    const overallEnergyExpendedLabels: CountryLabelValues[] = [];
    for (const categorySummary of consumptionSummaryEntry.categories) {
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
      for (const carbonEmissionLabel of carbonEmissionCategoryLabels) {
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
      }
      let foundEnergyExpendedLabel = false;
      for (const energyExpendedLabel of energyExpendedCategoryLabels) {
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
      }
    }
    // find label for overall annual consumption
    if (
      consumptionSummaryEntry.categories.filter(
        (consumptionSummaryEntryCategory) => consumptionSummaryEntryCategory.carbonEmission.label
      ).length > 0
    ) {
      for (const overallCarbonEmissionLabel of overallCarbonEmissionLabels) {
        if (
          overallCarbonEmissionLabel.maximum > consumptionSummaryEntry.carbonEmission.total &&
          overallCarbonEmissionLabel.minimum < consumptionSummaryEntry.carbonEmission.total
        ) {
          consumptionSummaryEntry.carbonEmission.label = overallCarbonEmissionLabel.label;
        }
      }
    } else {
      consumptionSummaryEntry.carbonEmission.label = undefined;
    }
    if (
      consumptionSummaryEntry.categories.filter(
        (consumptionSummaryEntryCategory) => consumptionSummaryEntryCategory.energyExpended.label
      ).length > 0
    ) {
      for (const overallEnergyExpendedLabel of overallEnergyExpendedLabels) {
        if (
          overallEnergyExpendedLabel.maximum > consumptionSummaryEntry.energyExpended.total &&
          overallEnergyExpendedLabel.minimum < consumptionSummaryEntry.energyExpended.total
        ) {
          consumptionSummaryEntry.energyExpended.label = overallEnergyExpendedLabel.label;
        }
      }
    } else {
      consumptionSummaryEntry.energyExpended.label = undefined;
    }
  }
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
  for (const year1 of Object.entries(monthlyConsumptionDistribution)) {
    for (const month of Object.entries(year1[1])) {
      monthlyConsumptionDistribution[Number(year1[0])][Number(month[0])] = (month[1] / totalDays) * consumptionValue;
    }
  }
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

function newConsumptionSummary(year: number, categories: string[]): ConsumptionSummary {
  const consumptionSummary: ConsumptionSummary = {
    year: year,
    version: latestConsumptionSummaryVersion,
    dateLastUpdated: Timestamp.now(),
    carbonEmission: {
      total: 0,
    },
    energyExpended: {
      total: 0,
    },
    categories: [],
    months: [],
  };
  for (const category of categories) {
    consumptionSummary.categories.push({
      category: category as ConsumptionCategory,
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
  }
  return consumptionSummary;
}
