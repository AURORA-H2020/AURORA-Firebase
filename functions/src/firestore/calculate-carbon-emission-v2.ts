import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { PreferredCloudFunctionRegion } from "../utils/preferred-cloud-function-region";
import { Timestamp } from "firebase-admin/firestore";
import { FirestoreCollections } from "../utils/firestore-collections";
import { Consumption } from "../models/consumption/consumption";
import { User } from "../models/user/user";
// import { ConsumptionSummary } from "../models/consumption-summary/consumption-summary";
import { CountryMetric } from "../models/country/metric/country-metric";
import { calculateConsumptionSummary } from "./includes/calculate-carbon-summary";
// import { firestore } from "firebase-admin";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

/**
 * [calculateCarbonEmissions]
 * A Cloud Function triggered by a document write in the consumptions sub-collection of a user.
 * This function will calculate the carbon emissions and write it to the corresponding property.
 */
export const calculateCarbonEmissionsBeta = functions
  .region(PreferredCloudFunctionRegion)
  .firestore.document(
    [FirestoreCollections.users.name, "{userId}", FirestoreCollections.users.consumptions.name, "{consumptionId}"].join(
      "/"
    )
  )
  .onWrite(async (snapshot, context) => {
    if (context.params.userId != "uw6h1wRVOvbEg4xKW2lx6nFqueA3") {
      return;
    }

    // check if this is a reinvocation and exit function if it is
    // check that document has not been deleted.
    if (snapshot.after.exists) {
      // check if the user entered value hasn't changed
      if (snapshot.after.data()?.value == snapshot.before.data()?.value) {
        // check whether the energy and carbon calculated properties exist
        if (snapshot.after.data()?.energyExpended && snapshot.after.data()?.carbonEmissions) {
          return; // exit function without doing anything
        }
      }
    }

    // Retrieve the user from the users collection by using the "userId" parameter from the path
    const user = (
      await admin.firestore().collection(FirestoreCollections.users.name).doc(context.params.userId).get()
    ).data() as User;
    if (!user) {
      throw new Error("User not found");
    }

    // Version of this implementation of the calculateConsumption function. Increase to trigger recalculating all consumptions on next data entry.
    const latestConsumptionVersion = "1.0.0";

    // Check if consumptionVersion matches with latest, else recalculate all consumptions
    if (user.consumptionVersion != latestConsumptionVersion || !user.consumptionVersion) {
      await admin
        .firestore()
        .collection(FirestoreCollections.users.name)
        .doc(context.params.userId)
        .collection(FirestoreCollections.users.consumptions.name)
        .get()
        .then((snapshot) => {
          snapshot.forEach(async (singleConsumption) => {
            const calculatedConsumptions = await calculateConsumptions(
              singleConsumption.data() as Consumption,
              user,
              latestConsumptionVersion,
              context
            );
            if (calculatedConsumptions?.carbonEmission && calculatedConsumptions.energyExpended) {
              singleConsumption.ref.update({
                carbonEmissions: calculatedConsumptions.carbonEmission,
                energyExpended: calculatedConsumptions.energyExpended,
                version: latestConsumptionVersion,
              });
            }
          });
        });
      // Write latest version to user after recalculating all consumptions
      await admin.firestore().collection(FirestoreCollections.users.name).doc(context.params.userId).update({
        latestConsumptionVersion: latestConsumptionVersion,
      });
      // calculate Consumption Summary with updated consumptions. Passing no consumption will force recalculation based on all existing consumptions
      calculateConsumptionSummary(user, context);
    } else {
      // Check if document still exists. No calculation necessary if it has been deleted
      if (snapshot.after.exists) {
        // Calculate carbon emissions
        const calculatedConsumptions = await calculateConsumptions(
          snapshot.after.data() as Consumption,
          user,
          latestConsumptionVersion,
          context
        );
        // Check if carbon emissions are available
        if (calculatedConsumptions?.carbonEmission && calculatedConsumptions.energyExpended) {
          // Update consumption and set calculated carbon emissions
          await admin
            .firestore()
            .collection(FirestoreCollections.users.consumptions.path(context.params.userId))
            .doc(context.params.consumptionId)
            .update({
              carbonEmissions: calculatedConsumptions.carbonEmission,
              energyExpended: calculatedConsumptions.energyExpended,
              version: latestConsumptionVersion,
            });
        }

        // get consumption again from firestore, as it has been updated with calculated consumptions
        const consumption = (
          await admin
            .firestore()
            .collection(FirestoreCollections.users.name)
            .doc(context.params.userId)
            .collection(FirestoreCollections.users.consumptions.name)
            .doc(context.params.consumptionId)
            .get()
        ).data();

        calculateConsumptionSummary(user, context, consumption as Consumption);
      } else {
        // if there is no snapshot.after, document has been deleted, hence needs to be removed from the summary
        calculateConsumptionSummary(user, context, snapshot.before.data() as Consumption, true);
      }
    }

    /*
    // OLD CONSUMPTION SUMMARY
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
    */
  });

/**
 * Calculate carbon emissions
 * @param snapshot The document snapshot.
 * @param context The event context.
 */
async function calculateConsumptions(
  consumption: Consumption,
  user: User,
  latestConsumptionVersion: string,
  context: functions.EventContext<Record<string, string>>
): Promise<{ carbonEmission: number; energyExpended: number } | undefined> {
  // Country to fall back to in case returned EF value is not a number
  const metricsFallbackCountry = "sPXh74wjZf14Jtmkaas6";

  // Get date of consumption: startDate for periodic consumptions and dateOfTravel for transportation
  const consumptionDate: Timestamp | undefined =
    consumption.electricity?.startDate ?? consumption.heating?.startDate ?? consumption.transportation?.dateOfTravel;
  if (!consumptionDate) {
    console.log("Consumption Date is missing");
    return undefined;
  }

  /*
  // Check if consumptions are available on a consumption and version is latest
  if (
    consumption.carbonEmissions &&
    consumption.energyExpended &&
    user.consumptionVersion == latestConsumptionVersion
  ) {
    // Return undefined as calculating the carbon emissions is not needed
    return undefined;
  }
  */

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

      // Fallback in case heatingEF is not a Number
      if (!heatingEF) {
        metrics = await getMetrics(metricsFallbackCountry, consumptionDate);
        heatingEF = getHeatingEF(heatingData, metrics);
      }

      const consumptionData = {
        // Calculation for the carbon emission. Takes the entered kWh value, divided by the number of people in the household, times the heating emission factor.
        carbonEmission: (consumption.value / heatingData.householdSize) * heatingEF ?? undefined,
        energyExpended: consumption.value ?? undefined,
      };
      if (consumptionData.carbonEmission && consumptionData.energyExpended) return consumptionData;
      else return undefined;
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

      // Fallback in case electricityEF is not a Number
      if (!electricityEF) {
        metrics = await getMetrics(metricsFallbackCountry, consumptionDate);
        electricityEF = getElectricityEF(electricityData, metrics);
      }

      const consumptionData = {
        // Calculation for the carbon emission. Takes the entered kWh value, divided by the number of people in the household, times the electricity emission factor.
        carbonEmission: (consumption.value / electricityData.householdSize) * electricityEF ?? undefined,
        energyExpended: consumption.value ?? undefined,
      };
      if (consumptionData.carbonEmission && consumptionData.energyExpended) return consumptionData;
      else return undefined;
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
      } else if (transportationFactors?.carbonEF && transportationFactors.energyEF) {
        // For all other transportation types: Transport Emission Factor is in kg CO2 per km, so it is just multiplied with the value given in kilometer.
        return {
          carbonEmission: consumption.value * transportationFactors.carbonEF,
          energyExpended: consumption.value * transportationFactors.energyEF,
        };
      } else return undefined;
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
  if (!metrics.electricity.default) {
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
  if (!transportationData) {
    return undefined;
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
      if (transportationType in ["motorcycle, electricMotorcycle"]) {
        privateVehicleOccupancy = 2;
      } else if (privateVehicleOccupancy > 5) {
        privateVehicleOccupancy = 5;
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
 * [getMetrics]
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
        return undefined;
      }
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
/*
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

  // Find the list index of consumptionSummary for the current consumptionCategory
  const consumptionCategorySummaryID = consumptionSummary.entries.findIndex(
    ({ category }) => category === consumptionCategory
  );

  // Update consumptionCategory by adding new consumptionValue
  if (consumptionSummary.entries[consumptionCategorySummaryID].absoluteValue) {
    consumptionSummary.entries[consumptionCategorySummaryID].absoluteValue += consumptionCarbonEmissions;
  } else {
    consumptionSummary.entries[consumptionCategorySummaryID].absoluteValue = consumptionCarbonEmissions;
    // TODO: Should there be a NaN value in a consumption Category Summary, all consumptions need to be summed individually.
  }

  // Sum all carbon emission values in consumption summary
  let totalCarbonEmissions = 0;
  consumptionSummary.entries.forEach((item) => {
    totalCarbonEmissions += item.absoluteValue;
  });

  // Calculate percentages for carbon emission categories
  if (totalCarbonEmissions && totalCarbonEmissions > 0) {
    consumptionSummary.entries.forEach((item) => {
      item.value = item.absoluteValue / totalCarbonEmissions;
    });
  } else {
    // Return an empty Consumption Summary if totalCarbonEmissions is zero
    return newConsumptionSummary();
  }

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
        absoluteValue: 0,
      },
      {
        category: "transportation",
        value: 0,
        absoluteValue: 0,
      },
      {
        category: "heating",
        value: 0,
        absoluteValue: 0,
      },
    ],
  };
}
*/

/**
 * [copyMetrics]
 * This function is commented out intentionally.
 * It is only used for copying metrics from one country to multiple others to avoid excessive work on the Firestore visual editor.
 */
/*
async function copyMetrics() {
  const db = admin.firestore().collection(FirestoreCollections.countries.name);
  const listOfCountries = [
    "2E9Ejc8qBJC6HnlPPdIh",
    "4sq82jNQm3x3bH9Fkijm",
    "8mgi5IR4xn9Yca4zDLtU",
    "KhUolhyvcbdEsPyREqOZ",
    "udn3GiM30aqviGBkswpl",
  ];
  db.doc("sPXh74wjZf14Jtmkaas6")
    .collection(FirestoreCollections.countries.metrics.name)
    .get()
    .then((snapshot) => {
      const euMetricData = snapshot.docs[0].data();
      listOfCountries.forEach((item) => {
        const setDoc = db
          .doc(item)
          .collection(FirestoreCollections.countries.metrics.name)
          .doc(snapshot.docs[0].id)
          .set(euMetricData);
        setDoc.then((res) => {
          console.log("Set: ", res);
        });
      });
    });
}
*/
