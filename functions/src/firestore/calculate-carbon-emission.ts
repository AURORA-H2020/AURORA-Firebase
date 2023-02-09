import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { PreferredCloudFunctionRegion } from "../utils/preferred-cloud-function-region";
import { Timestamp } from "firebase-admin/firestore";
import { FirestoreCollections } from "../utils/firestore-collections";
import { Consumption } from "../models/consumption/consumption";
import { User } from "../models/user/user";
import { ConsumptionSummary } from "../models/consumption-summary/consumption-summary";
import { CountryMetric } from "../models/country/metric/country-metric";
// import { firestore } from "firebase-admin";

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
  ).data() as User;
  if (!user) {
    throw new Error("User not found");
  }

  // Country to fall back to in case returned EF value is not a number
  const metricsFallbackCountry = "sPXh74wjZf14Jtmkaas6";

  const consumption = snapshot.after.data() as Consumption;
  if (!consumption) {
    return undefined;
  }

  // Get date of consumption: startDate for periodic consumptions and dateOfTravel for transportation
  const consumptionDate: Timestamp | undefined =
    consumption.electricity?.startDate ?? consumption.heating?.startDate ?? consumption.transportation?.dateOfTravel;
  if (!consumptionDate) {
    console.log("Consumption Date is missing");
    return undefined;
  }

  // Check if carbon emissions are available on a consumption
  if (consumption.carbonEmissions) {
    // Return undefined as calculating the carbon emissions is not needed
    return undefined;
  }

  switch (consumption.category) {
    /**
     * ///// HEATING CALCULATIONS /////
     */
    case "heating": {
      const heatingData = consumption.heating;
      if (!heatingData) {
        // Log error and exit if electricity data does not exist
        console.log(
          "Heating data does not exist on User: ",
          context.params.userId,
          " | Consumption: ",
          context.params.consumptionId
        );
        return undefined;
      }

      let metrics = await getMetrics(user.country, consumptionDate);
      let heatingEF = getHeatingEF(heatingData, metrics);

      // Fallback in case transportationEF is not a Number
      if (!heatingEF) {
        metrics = await getMetrics(metricsFallbackCountry, consumptionDate);
        heatingEF = getHeatingEF(heatingData, metrics);
      }
      // Calculation for the carbon emission. Takes the entered kWh value, divided by the number of people in the household, times the heating emission factor.
      return (consumption.value / heatingData.householdSize) * heatingEF;
    }

    /**
     * ///// ELECTRICITY CALCULATIONS /////
     */
    case "electricity": {
      const electricityData = consumption?.electricity;

      if (!electricityData) {
        // Log error and exit if electricity data does not exist
        console.log(
          "Electricity data does not exist on User: ",
          context.params.userId,
          " | Consumption: ",
          context.params.consumptionId
        );
        return undefined;
      }

      let metrics = await getMetrics(user.country, consumptionDate);
      let electricityEF = getElectricityEF(electricityData, metrics);

      // Fallback in case electricityEF is NaN
      if (!electricityEF) {
        metrics = await getMetrics(metricsFallbackCountry, consumptionDate);
        electricityEF = getElectricityEF(electricityData, metrics);
      }

      // Calculation for the carbon emission. Takes the entered kWh value, divided by the number of people in the household, times the electricity emission factor.
      return (consumption.value / electricityData.householdSize) * electricityEF;
    }

    /**
     * ///// TRANSPORTATION CALCULATIONS /////
     */
    case "transportation": {
      const transportationData = consumption.transportation;
      if (!transportationData) {
        // Log error and exit if transportation data does not exist
        console.log(
          "Transportation data does not exist on User: ",
          context.params.userId,
          " | Consumption: ",
          context.params.consumptionId
        );
        return undefined;
      }

      let metrics = await getMetrics(user.country, consumptionDate);
      let transportationEF = getTransportationEF(transportationData, metrics);

      // Fallback in case transportationEF is not a Number
      if (!transportationEF) {
        metrics = await getMetrics(metricsFallbackCountry, consumptionDate);
        transportationEF = getTransportationEF(transportationData, metrics);
      }

      // Transport Emission Factor is in kg CO2 per km, so it is just multiplied with the value given kilometer.
      return consumption.value * transportationEF;
    }
  }
}

/**
 * [getHeatingEF]
 * Function to get latest heating Emission Factor for a consumption, given a metric.
 * @param heatingData Part of the consumption relevant to heating.
 * @param metrics Document Data containing all EF values (metrics).
 */
function getHeatingEF(heatingData: Consumption["heating"], metrics: admin.firestore.DocumentData) {
  if (!heatingData) {
    return undefined;
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
 * [getElectricityEF]
 * Function to get latest electricity Emission Factor for a consumption, given a metric.
 * @param electricityData Part of the consumption relevant to electricity.
 * @param metrics Document Data containing all EF values (metrics).
 */
function getElectricityEF(electricityData: Consumption["electricity"], metrics: admin.firestore.DocumentData) {
  if (!metrics.electricity) {
    return undefined;
  }
  return metrics.electricity.default;
}

/**
 * [getTransportationEF]
 * Function to get latest transportation Emission Factor for a consumption, given a metric.
 * @param transportationData Part of the consumption relevant to transportation.
 * @param metrics Document Data containing all EF values (metrics).
 */
function getTransportationEF(transportationData: Consumption["transportation"], metrics: admin.firestore.DocumentData) {
  // let transportationEF: number; // "Emission Factor" for transportation
  if (!transportationData) {
    return undefined;
  }

  const transportationType = transportationData?.transportationType;
  const publicVehicleOccupancy = transportationData?.publicVehicleOccupancy;
  if (
    publicVehicleOccupancy &&
    transportationType &&
    metrics.transportation &&
    transportationType in metrics.transportation
  ) {
    return metrics.transportation[transportationType][publicVehicleOccupancy];
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
    if (metrics.transportation && transportationType in metrics.transportation) {
      return metrics.transportation[transportationType][String(privateVehicleOccupancy)];
    } else {
      return undefined;
    }
  }
}

/**
 * [getMetric]
 * Function to get relevant metrics based on:
 * @param countryID ID of the associated country.
 * @param consumptionDate Timestamp of the consumption occurance to get the most viable metric version.
 */
async function getMetrics(countryID: string, consumptionDate: Timestamp | undefined) {
  const metrics = (await admin
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
    })) as CountryMetric;
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
  let consumptionCarbonEmissions: number;
  let consumptionCategory: string;

  if (!snapshot.after.exists) {
    // If action is delete, get emission value before and make negative
    consumptionCarbonEmissions = snapshot.before.data()?.carbonEmissions;
    consumptionCarbonEmissions *= -1;
    consumptionCategory = snapshot.before.data()?.category;
  } else {
    consumptionCarbonEmissions = snapshot.after.data()?.carbonEmissions;
    consumptionCategory = snapshot.after.data()?.category;
  }

  if (!consumptionCarbonEmissions) {
    // Return undefined if there is no carbon emission to run calculations with
    return undefined;
  }

  const user = (
    await admin.firestore().collection(FirestoreCollections.users.name).doc(context.params.userId).get()
  ).data() as User;

  let consumptionSummary: ConsumptionSummary | undefined;

  // Create new empty consumption summary if it does not already exist
  if (!user.consumptionSummary) {
    consumptionSummary = newConsumptionSummary();
  } else {
    consumptionSummary = user.consumptionSummary;
  }

  const consumptionCategorySummaryID = consumptionSummary.entries.findIndex(
    ({ category }) => category === consumptionCategory
  );

  // Update consumptionCategory by adding new consumptionValue
  if (consumptionSummary.entries[consumptionCategorySummaryID].value) {
    consumptionSummary.entries[consumptionCategorySummaryID].value += consumptionCarbonEmissions;
  } else {
    consumptionSummary.entries[consumptionCategorySummaryID].value = consumptionCarbonEmissions;
    // TODO: Should there be a NaN value in a consumption Category Summary, all consumptions need to be summed individually.
  }

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
