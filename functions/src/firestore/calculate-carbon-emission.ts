import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { PreferredCloudFunctionRegion } from "../utils/preferred-cloud-function-region";
import { Timestamp } from "firebase-admin/firestore";
import { ConsumptionCategory } from "../models/consumption/consumption-category";
import { FirestoreCollections } from "../utils/firestore-collections";
import { ConsumptionSummary } from "../models/consumption-summary/consumption-summary";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

/**
 * [calculateCarbonEmissions]
 * A Cloud Function triggered by a document write in the consumptions sub-collection of a user.
 * This function will calculate the carbon emissions and write it to the corresponding property.
 */
export const calculateCarbonEmissions = functions
  .region(PreferredCloudFunctionRegion)
  .firestore.document(
    [FirestoreCollections.users.name, "{userId}", FirestoreCollections.users.consumptions.name, "{consumptionId}"].join(
      "/"
    )
  )
  .onWrite(async (snapshot, context) => {
    // Calculate carbon emissions
    const calculatedCarbonEmissions = await carbonEmissions(snapshot, context);
    // Check if carbon emissions are available
    if (calculatedCarbonEmissions) {
      // Update consumption and set calculated carbon emissions
      await admin
        .firestore()
        .collection(FirestoreCollections.users.consumptions.path(context.params.userId))
        .doc(context.params.consumptionId)
        .update({ carbonEmissions: calculatedCarbonEmissions });
    }
    // Calculate consumption summary
    const calculatedConsumptionSummary = await consumptionSummary(snapshot, context);
    // Check if consumption summary is available
    if (calculatedConsumptionSummary) {
      // Update consumption summary
      await admin
        .firestore()
        .collection(FirestoreCollections.users.name)
        .doc(context.params.userId)
        .update({ consumptionSummary: calculatedConsumptionSummary });
    }
  });

/**
 * Calculate carbon emissions
 * @param snapshot The document snapshot.
 * @param context The event context.
 */
async function carbonEmissions(
  snapshot: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext<Record<string, string>>
): Promise<number | undefined> {
  // Check if document has been deleted
  if (!snapshot.after.exists) {
    // Return undefined as document has been deleted
    // and therefore a calculation is not needed
    return undefined;
  }

  // First retrieve the user from the users collection by using the "userId" parameter from the path
  const user = (
    await admin.firestore().collection(FirestoreCollections.users.name).doc(context.params.userId).get()
  ).data();
  if (!user) {
    throw new Error("User not found");
  }

  // Country to fall back to in case returned EF value is not a number
  const metricsFallbackCountry = "sPXh74wjZf14Jtmkaas6";

  const consumption = snapshot.after.data();

  // Check if carbon emissions are available on a consumption
  if (consumption?.carbonEmissions) {
    // Return undefined as calculating the carbon emissions is not needed
    return undefined;
  }

  const consumptionCategory: ConsumptionCategory = consumption?.category;

  switch (consumptionCategory) {
    case "heating": {
      /**
       * ///// HEATING CALCULATIONS /////
       */
      let metrics = await getMetrics(user.country, await getConsumptionDate(consumption));
      const heatingData = consumption?.heating;
      let heatingEF = getHeatingEF(heatingData, metrics);

      // Fallback in case transportationEF is not a Number
      if (Number.isNaN(heatingEF)) {
        metrics = await getMetrics(metricsFallbackCountry, await getConsumptionDate(consumption));
        heatingEF = getHeatingEF(heatingData, metrics);
      }

      // calculation for the carbon emission. Takes the entered kWh value, divided by the number of people in the household, times the heating emission factor.
      return (consumption?.value / heatingData.householdSize) * heatingEF;
    }

    /**
     * ///// ELECTRICITY CALCULATIONS /////
     */
    case "electricity": {
      let metrics = await getMetrics(user.country, await getConsumptionDate(consumption));
      const electricityData = consumption?.electricity;
      let electricityEF = getElectricityEF(electricityData, metrics);

      // Fallback in case transportationEF is not a Number
      if (Number.isNaN(electricityEF)) {
        metrics = await getMetrics(metricsFallbackCountry, await getConsumptionDate(consumption));
        electricityEF = getHeatingEF(electricityData, metrics);
      }

      // calculation for the carbon emission. Takes the entered kWh value, divided by the number of people in the household, times the electricity emission factor.
      return (consumption?.value / electricityData.householdSize) * electricityEF;
    }

    /**
     * ///// TRANSPORTATION CALCULATIONS /////
     */
    case "transportation": {
      let metrics = await getMetrics(user.country, await getConsumptionDate(consumption));
      const transportationData = consumption?.transportation;
      let transportationEF = getTransportationEF(transportationData, metrics);

      // Fallback in case transportationEF is not a Number
      if (Number.isNaN(transportationEF)) {
        metrics = await getMetrics(metricsFallbackCountry, await getConsumptionDate(consumption));
        transportationEF = getHeatingEF(transportationData, metrics);
      }

      // Since the transport Emission Factor is already in kg CO2 per km, it can simply be multiplied with the kilometer value.
      return consumption?.value * transportationEF;
    }
  }
}

/**
 * [getConsuptionDate]
 * Function to get the date the consumption occured. Uses "startDate" for periodic consumptions.
 */
async function getConsumptionDate(consumption: admin.firestore.DocumentData | undefined): Promise<Timestamp> {
  const consumptionCategory: ConsumptionCategory = consumption?.category;
  switch (consumptionCategory) {
    case "heating":
    case "electricity": {
      return consumption?.[consumptionCategory].startDate;
    }
    case "transportation": {
      return consumption?.[consumptionCategory].dateOfTravel;
    }
  }
}

/**
 * [getHeatingEF]
 * Function to get latest heating Emission Factor for a consumption, given a metric.
 * @param heatingData Part of the consumption relevant to heating.
 * @param metrics Document Data containing all EF values (metrics).
 */
function getHeatingEF(heatingData: admin.firestore.DocumentData, metrics: admin.firestore.DocumentData) {
  let heatingEF = 0; // "Emission Factor" for heating
  switch (heatingData.heatingFuel) {
    // If the user has selected "Electric Heating", the electricity values will be used.
    case "electric": {
      heatingEF = metrics.electricity.default;
      break;
    }
    case "district": {
      heatingEF = metrics.heating[heatingData.districtHeatingSource]; // TODO: Add electric for district heating
      break;
    }
    // If consumption has any other type of heating, simply look the Emission Factor up.
    default: {
      heatingEF = metrics.heating[heatingData.heatingFuel];
      break;
    }
  }

  return heatingEF;
}

/**
 * [getElectricityEF]
 * Function to get latest electricity Emission Factor for a consumption, given a metric.
 * @param electricityData Part of the consumption relevant to electricity.
 * @param metrics Document Data containing all EF values (metrics).
 */
function getElectricityEF(electricityData: admin.firestore.DocumentData, metrics: admin.firestore.DocumentData) {
  const electricityEF = metrics.electricity.default;
  return electricityEF;
}

/**
 * [getTransportationEF]
 * Function to get latest transportation Emission Factor for a consumption, given a metric.
 * @param transportationData Part of the consumption relevant to transportation.
 * @param metrics Document Data containing all EF values (metrics).
 */
function getTransportationEF(transportationData: admin.firestore.DocumentData, metrics: admin.firestore.DocumentData) {
  let transportationEF = 0; // "Emission Factor" for transportation
  const transportationType = transportationData.transportationType;
  const publicVehicleOccupancy = transportationData.publicVehicleOccupancy; // TODO: Implement types
  if (publicVehicleOccupancy) {
    transportationEF = metrics.transportation[transportationType][publicVehicleOccupancy];
  } else {
    let privateVehicleOccupancy = transportationData.privateVehicleOccupancy;
    if (!privateVehicleOccupancy) {
      privateVehicleOccupancy = 1;
    } else if (privateVehicleOccupancy > 5) {
      if (transportationType in ["motorcycle, electricMotorcycle"]) {
        privateVehicleOccupancy = 2;
      } else {
        privateVehicleOccupancy = 5;
      }
    }
    console.log(privateVehicleOccupancy);
    transportationEF = metrics.transportation[transportationType][String(privateVehicleOccupancy)];
  }

  // Since the transport Emission Factor is already in kg CO2 per km, it can simply be multiplied with the kilometer value.
  return transportationEF;
}

/**
 * [getMetrics]
 * Function to get relevant metrics based on:
 * @param countryID ID of the associated country.
 * @param consumptionDate Timestamp of the consumption occurance to get the most viable metric version.
 */
async function getMetrics(countryID: string, consumptionDate: Timestamp) {
  const metrics = await admin
    .firestore()
    .collection(FirestoreCollections.countries.name)
    .doc(countryID)
    .collection(FirestoreCollections.countries.metrics.name)
    .where("validFrom", "<", consumptionDate)
    .orderBy("validFrom", "desc")
    .limit(1)
    .get()
    .then((querySnapshot) => {
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data();
      } else {
        return null;
      } // TODO: add standard EU metrics as fallback?
    });
  if (!metrics) {
    throw new Error("Country not found");
  }
  return metrics;
}

/**
 * Calculate ConsumptionSummary
 * @param snapshot The document snapshot.
 * @param context The event context.
 */
async function consumptionSummary(
  snapshot: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext<Record<string, string>>
): Promise<ConsumptionSummary | undefined> {
  const user = (
    await admin.firestore().collection(FirestoreCollections.users.name).doc(context.params.userId).get()
  ).data();

  let consumptionSummary: ConsumptionSummary = user?.consumptionSummary;

  // Create new empty consumption summary if it does not already exist
  if (!consumptionSummary) {
    consumptionSummary = newConsumptionSummary();
  }

  const consumptionCategory = snapshot.after.data()?.category;
  const consumptionCarbonEmissions = snapshot.after.data()?.carbonEmissions;
  const consumptionCategorySummaryID = consumptionSummary.entries.findIndex(
    ({ category }) => category === consumptionCategory
  );

  // Update consumptionCategory by adding new consumptionValue
  consumptionSummary.entries[consumptionCategorySummaryID].value += consumptionCarbonEmissions;

  // Sum all carbon emission values in consumption summary
  let totalCarbonEmissions = 0;
  consumptionSummary.entries.forEach((item) => {
    totalCarbonEmissions += item.value;
  });

  // Update total carbon emissions in consumption summary
  consumptionSummary.totalCarbonEmissions = totalCarbonEmissions;

  return consumptionSummary;
}

function newConsumptionSummary(): ConsumptionSummary {
  return {
    totalCarbonEmissions: 0,
    entries: [
      {
        category: "electricity",
        value: 0,
      },
      {
        category: "transportation",
        value: 0,
      },
      {
        category: "heating",
        value: 0,
      },
    ],
  };
}
