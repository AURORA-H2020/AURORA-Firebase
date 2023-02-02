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
  // For some reason the line below gives me "NaN" values in the calculations, so overriding it for testing purposes with "100"
  // const value = snapshot.after.data()?.value
  const value = 100
  let carbonEmission = 0 // This can probably be removed, as there should be no scenario where a value other than electricity, transportation or heating is set as the category.

  /**
  * I am unsure how to get values from the "sites" collection in Firebase, so I just recreated it here.
  * This will need to be properly integrated.
  */

  // I dont know how to get the users selected site, as it is higher up in the hirarchy than the current snapshot.
  // Additionally, information about "heating type" will need to be included per entry, as well as household size.
  // In the future, these values will default to whatever the user has configured for their household.
  const userTestValues = {
    site: "8yancCd0U8IOTE6VzBEa",
    heatingType: "naturalGas",
    householdSize: 1
  }

  // Switch statement based on the emission category. Only "heating", "transportation", and "electricity" should be valid options.
  switch (category) {
    case "heating": {

      let heatingEF = 0

      switch (userTestValues.heatingType) {
        // If the user has selected "Electric Heating", the electricity values will be used.
        case ("electricHeating"): {
          heatingEF = getTestValue("electricity","","",userTestValues.site)
          break;
        }
        // If they use any other type of heating we simply look the Emission Factor up.
        default: {
          heatingEF = getTestValue("electricity","","",userTestValues.site)
        }
      }


      // heatingEF is the "Emission Factor" for heating. Takes the appropriate value based on the user's heating type from "emissionFactorsGlobal.heating".
      // const heatingEF = emissionFactorsGlobal.heating[userTestValues.heatingType as keyof typeof emissionFactorsGlobal.heating]
      const householdSize = userTestValues.householdSize
      // calculation for the carbon emission. Simply takes the entered kWh value, divided by the number of people in the household, times the heating emission factor.
      carbonEmission = (value / householdSize) * heatingEF;
      break;
    }

    case "transportation": {
      const transportationType = snapshot.after.data()?.transportation.transportationType
      const transportationOccupancy = snapshot.after.data()?.transportation.publicVehicleOccupancy // TODO: Would need to be renamed to "transportationOccupancy", as it is not just for public transport, but also personal cars.
      const transportEF = getTestValue("transportation",transportationType,transportationOccupancy,userTestValues.site)
      // Since the transport Emission Factor is already in kg CO2 per km, it can simply be multiplied with the kilometer value.
      carbonEmission =  value*transportEF;
      break;
    }

    case "electricity": {
      // electricityEF is the "Emission Factor" for electricity. Takes the appropriate value based on the user's site from "sites[site].electricity".
      const electricityEF = getTestValue("electricity","","",userTestValues.site)
      const householdSize = userTestValues.householdSize
      // calculation for the carbon emission. Simply takes the entered kWh value, divided by the number of people in the household, times the electricity emission factor.
      carbonEmission = (value / householdSize) * electricityEF;
      break;
    }
  }
  return carbonEmission;
}


/**
 * [getTestValue]
 * This entire function only exists as a replacement for the Firebase implementation, which I dont know how to do.
 */

function getTestValue (
  category: string, // transport, electricity, or heating
  subcategory: string, // Such as heating source or transport vehicle
  subsubcategory: string, // Only transport occupancy uses this
  site: string
) {

  // Copy of the "Sites" collection in Firebase
  const sites = {
    "8yancCd0U8IOTE6VzBEa": {
      site: "Denmark",
      electricity: 0.116,
      transportation: {
        "electricBus": {
          "almostEmpty": 0.216297,
          "medium": 0.068782,
          "nearlyFull": 0.040893
        },
        "fuelCar": {
          "one": 0.18886,
          "two": 0.07927503,
          "three": 0.057182913,
          "four": 0.046264855,
          "five": 0.03981642
        }
      }
    },
    "YNkAonVX5g9zV2S8Do8b": {
      site: "Portugal",
      electricity: 0.201,
      transportation: 0.1
    },
    "JqlDcJN6yaVMOM6CxkSo": {
      site: "Slovenia",
      electricity: 0.219,
      transportation: 0.1
    },
    "P2dpcsdZns3514ylEP7U": {
      site: "Spain",
      electricity: 0.19,
      transportation: 0.1
    },
    "tR22sHpRRLuEc8R5XQDs": {
      site: "UK",
      electricity: 0.209,
      transportation: 0.1
    },
  }

  // This currently does not exist in Firebase. Unsure how it should be implemented, but essentially these values are "Global", so applicable across all sites.
  const emissionFactorsGlobal = {
    heating: {
      "heatingOil": 0.267,
      "naturalGas": 0.202,
      "liquifiedPetroGas": 0.227,
      "bioMass": 0.118,
      "bioMassLocal": 0,
      "geoThermal": 0.05,
      "solarThermal": 0.0396,
      "districtCoal": 0.354,
      "districtBiomass": 0.118,
      "districtWasteTreatment": 0.5486,
      "districtDefault": 0.2652
    }
  }

  
  let EFvalue = 0

  switch (category) {
    case ("electricity"): {
      EFvalue = sites[site as keyof typeof sites].electricity;
      break;
    }

    case ("transportation"): {
      // select list of transportations by demosite
      const transportList = sites[site as keyof typeof sites].transportation
      // select available occupancy levels for given transportation
      const transportOccupancy = transportList[subcategory as keyof typeof transportList]
      // select  Emission Factor for occupancy of transport type
      const transportEF = transportOccupancy[subsubcategory as keyof typeof transportOccupancy]

      EFvalue = transportEF;
      break;
    }

    case ("heating"): {
      EFvalue = emissionFactorsGlobal.heating[subcategory as keyof typeof emissionFactorsGlobal.heating];
    }
  }

  return EFvalue

}
