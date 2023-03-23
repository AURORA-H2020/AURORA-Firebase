import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { PreferredCloudFunctionRegion } from "../utils/preferred-cloud-function-region";
import { Timestamp } from "firebase-admin/firestore";
import { FirestoreCollections } from "../utils/firestore-collections";
import { Consumption } from "../models/consumption/consumption";
import { User } from "../models/user/user";
import { CountryMetric } from "../models/country/metric/country-metric";
import { calculateConsumptionSummary } from "./includes/calculate-carbon-summary";

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
    if (snapshot.after.data()) {
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
      console.log(
        "Consumption version mismatch.\n Was: " +
          user.consumptionVersion +
          " | Expected: " +
          latestConsumptionVersion +
          " \n Recalculating consumption summary for user: " +
          context.params.userId
      );
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
        consumptionVersion: latestConsumptionVersion,
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
        // If there is no snapshot.after, document has been deleted, hence needs to be removed from the summary
        calculateConsumptionSummary(user, context, snapshot.before.data() as Consumption, true);
      }
    }
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
    throw new Error("Consumption Date is missing");
  }

  switch (consumption.category) {
    /**
     * ///// HEATING CALCULATIONS /////
     */
    case "heating": {
      const heatingData = consumption.heating;
      if (!heatingData) {
        // Log error and exit if electricity data does not exist
        throw new Error(
          "Heating data does not exist on User: " +
            context.params.userId +
            " | Consumption: " +
            context.params.consumptionId
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
        energyExpended: consumption.value ?? undefined,
      };
      if (consumptionData.carbonEmission && consumptionData.energyExpended) return consumptionData;
      else
        throw new Error(
          "Missing carbonEmission and/or energyExpended data for user " +
            context.params.userId +
            " on entering consumption " +
            context.params.consumptionId +
            "[heating]"
        );
    }

    /**
     * ///// ELECTRICITY CALCULATIONS /////
     */
    case "electricity": {
      const electricityData = consumption?.electricity;

      if (!electricityData) {
        // Log error and exit if electricity data does not exist
        throw new Error(
          "Electricity data does not exist on User: " +
            context.params.userId +
            " | Consumption: " +
            context.params.consumptionId
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
        // Calculation for the carbon emission. Takes the entered kWh value, divided by the number of people in the household, times the electricity emission factor.
        carbonEmission: (consumption.value / electricityData.householdSize) * electricityEF ?? undefined,
        energyExpended: consumption.value ?? undefined,
      };
      if (consumptionData.carbonEmission && consumptionData.energyExpended) return consumptionData;
      else
        throw new Error(
          "Missing carbonEmission and/or energyExpended data for user " +
            context.params.userId +
            " on entering consumption " +
            context.params.consumptionId +
            "[electricity]"
        );
    }

    /**
     * ///// TRANSPORTATION CALCULATIONS /////
     */
    case "transportation": {
      const transportationData = consumption.transportation;
      if (!transportationData) {
        // Log error and exit if transportation data does not exist
        throw new Error(
          "Transportation data does not exist on User: " +
            context.params.userId +
            " | Consumption: " +
            context.params.consumptionId
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
      } else if (transportationFactors?.carbonEF && transportationFactors.energyEF) {
        // For all other transportation types: Transport Emission Factor is in kg CO2 per km, so it is just multiplied with the value given in kilometer.
        return {
          carbonEmission: consumption.value * transportationFactors.carbonEF,
          energyExpended: consumption.value * transportationFactors.energyEF,
        };
      } else
        throw new Error(
          "Missing carbonEmission and/or energyExpended data for user " +
            context.params.userId +
            " on entering consumption " +
            context.params.consumptionId +
            "[transportation]"
        );
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
  if (!heatingData) throw new Error("Could not get heating metric in 'getHeatingEF'");

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
  if (!metrics.electricity.default) throw new Error("Could not get electricity metric in 'getElectricityEF'");
  return metrics.electricity.default;
}

/**
 * [getTransportationEF]
 * Function to get latest transportation Emission Factor for a consumption, given a metric.
 * @param transportationData Part of the consumption relevant to transportation.
 * @param metrics Document Data containing all EF values (metrics).
 */
function getTransportationEF(transportationData: Consumption["transportation"], metrics: admin.firestore.DocumentData) {
  if (!transportationData) throw new Error("Could not get transportation metric in 'getTransportationEF'");

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
