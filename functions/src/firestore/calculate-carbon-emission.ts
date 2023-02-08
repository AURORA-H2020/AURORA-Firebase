import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../utils/constants";
import * as Path from "path";
import { ConsumptionCategory } from "../models/consumption-category";
import { Timestamp } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

/**
 * [calculateCarbonEmissions]
 * A Cloud Function triggered by a document write in the consumptions sub-collection of a user.
 * This function will calculate the carbon emissions and write it to the corresponding property.
 */
export const calculateCarbonEmissions = functions
  .region(preferredRegion)
  .firestore.document(Path.join(usersCollectionName, "{userId}", consumptionsCollectionName, "{consumptionId}"))
  .onWrite(async (snapshot, context) => {
    const calculatedCarbonEmissions = await carbonEmissions(snapshot, context);
    await admin
      .firestore()
      .doc(
        Path.join(usersCollectionName, context.params.userId, consumptionsCollectionName, context.params.consumptionId)
      )
      .update({ carbonEmissions: calculatedCarbonEmissions });
  });

/**
 * Calculate carbon emissions
 * @param snapshot The document snapshot.
 * @param context The event context.
 */
async function carbonEmissions(
  snapshot: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext<Record<string, string>>
): Promise<number> {
  // First retrieve the user from the users collection by using the "userId" parameter from the path
  const user = (await admin.firestore().collection("users").doc(context.params.userId).get()).data();
  if (!user) {
    throw new Error("User not found");
  }

  // Country to fall back to in case returned EF value is not a number
  const metricsFallbackCountry = "sPXh74wjZf14Jtmkaas6";

  // return getEmissionFactor(user.country, snapshot.after.data());

  const consumption = snapshot.after.data();
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
  let transportEF = 0; // "Emission Factor" for transportation
  const transportationType = transportationData.transportationType;
  const publicVehicleOccupancy = transportationData.publicVehicleOccupancy; // TODO: Implement types
  if (publicVehicleOccupancy) {
    transportEF = metrics.transportation[transportationType][publicVehicleOccupancy];
  } else {
    let privateVehicleOccupancy = transportationData.publicVehicleOccupancy;
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
    transportEF = metrics.transportation[transportationType][String(privateVehicleOccupancy)];
  }

  // Since the transport Emission Factor is already in kg CO2 per km, it can simply be multiplied with the kilometer value.
  return transportationData.value * transportEF;
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
    .collection("countries")
    .doc(countryID)
    .collection("metrics")
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
