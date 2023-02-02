import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../utils/constants";
import * as Path from "path";
import { ConsumptionCategory } from "../models/consumption-category"

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
  // TODO: Correctly calculate carbon emissions

  const category: ConsumptionCategory = snapshot.after.data()?.category
  const value = snapshot.after.data()?.category
  let carbonEmission = 0 // This can probably be removed, as there should be no scenario where a value other than electricity, transportation or heating is set as the category.

  /**
  * I am unsure how to get values from the "sites" collection in Firebase, so I just recreated it here.
  * This will need to be properly integrated.
  */

  // Copy of the "Sites" collection in Firebase
  const sites = {
    "8yancCd0U8IOTE6VzBEa": {
      site: "Denmark",
      electricity: 0.116,
      transportation: 0.1
    },
    "YNkAonVX5g9zV2S8Do8b": {
      site: "Portugal",
      electricity: 0.201
    },
    "JqlDcJN6yaVMOM6CxkSo": {
      site: "Slovenia",
      electricity: 0.219
    },
    "P2dpcsdZns3514ylEP7U": {
      site: "Spain",
      electricity: 0.19
    },
    "tR22sHpRRLuEc8R5XQDs": {
      site: "UK",
      electricity: 0.209
    },
  }

  // This currently does not exist in Firebase. Unsure how it should be implemented, but essentially these values are "Global", so applicable across all sites.
  /**
  const emissionFactorsGlobal = {
    heating: {
      heatingOil: 0.267,
      naturalGas: 0.202,
      liquifiedPetroGas: 0.227,
      bioMass: 0.118,
      bioMassLocal: 0,
      geoThermal: 0.05,
      solarThermal: 0.0396,
      districtCoal: 0.354,
      districtBiomass: 0.118,
      districtWasteTreatment: 0.5486,
      districtDefault: 0.2652
    }
  }
  */

  // I dont know how to get the users selected site, as it is higher up in the hirarchy than the current snapshot.
  const userTestValues = {
    site: "8yancCd0U8IOTE6VzBEa",
    householdSize: 1
  }

  // Switch statement based on the emission category. Only "heating", "transportation", and "electricity" should be valid options.
  switch (category) {
    case "heating":
      carbonEmission = value*1.5;
      break;

    case "transportation":
      carbonEmission =  1.0;
      break;

    case "electricity": {
      // electricityEF is the "Emission Factor" for electricity. Takes the appropriate value based on the user's site from "sites[site].electricity"
      const electricityEF = sites[userTestValues.site as keyof typeof sites].electricity
      // calculation for the carbon emission. Simply takes the entered kWh value, divided by the number of people in the household, times the electricity emission factor.
      const householdSize = userTestValues.householdSize
      carbonEmission = (value / householdSize) * electricityEF;
      break;
    }
      
      
    default:
      break;

  }
  return carbonEmission;
}
