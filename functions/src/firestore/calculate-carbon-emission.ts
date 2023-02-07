import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../utils/constants";
import * as Path from "path";
// import { ConsumptionCategory } from "../models/consumption-category";
// import { Timestamp } from "firebase-admin/firestore";

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

  const consumption = snapshot.after.data();
  const consumptionDate = getConsumptionDate(snapshot);

  // First retrieve the user from the users collection by using the "userId" parameter from the path
  const user = (await admin.firestore().collection("users").doc(context.params.userId).get()).data();
  if (!user) {
    throw new Error("User not found");
  }
  // Retrieve the most recent country metric based on the consumptionDate using the property "country" of a user which contains the id of a document
  const metrics = (await admin.firestore()
    .collection("countries").doc(user.country)
    .collection("metrics")
    .where("validFrom", "<", consumptionDate)
    .orderBy("validFrom", "desc").limit(1)
    .get()
    .then(querySnapshot => {
      if(!querySnapshot.empty) {
        console.log("Query result:", querySnapshot.docs[0].data());
        return querySnapshot.docs[0].data();
      }
      else { return null }; // TODO: add standard EU metrics as fallback?
    }));
  if (!metrics) {
    throw new Error("Country not found");
  }
  console.log(metrics);

  // const category: ConsumptionCategory = consumption?.category;
  // For some reason the line below gives me "NaN" values in the calculations, so overriding it for testing purposes with "100"
  const value = consumption?.value;
  console.log("Consumption Value:", value);
  if (!value) {
    throw Error();
  }
  // let carbonEmission = 0 // This can probably be removed, as there should be no scenario where a value other than electricity, transportation or heating is set as the category.

  /**
   * I am unsure how to get values from the "sites" collection in Firebase, so I just recreated it here.
   * This will need to be properly integrated.
   */

  // I dont know how to get the users selected site, as it is higher up in the hirarchy than the current snapshot.
  // Additionally, information about "heating type" will need to be included per entry, as well as household size.
  // In the future, these values will default to whatever the user has configured for their household.
  const userTestValues = {
    householdSize: 1,
  };

  

  // Switch statement based on the emission category. Only "heating", "transportation", and "electricity" should be valid options.
  switch (consumption?.category) {
    case "heating": {
      let heatingEF = 0;
      const heatingData = snapshot.after.data()?.heating
      switch (heatingData.heatingFuel) {
        // If the user has selected "Electric Heating", the electricity values will be used.
        case "electricHeating": {
          heatingEF = metrics.electricity.default;
          break;
        }
        case "district": {
          heatingEF = metrics.heating[heatingData.districtHeatingSource];
          break;
        }
        // If they use any other type of heating we simply look the Emission Factor up.
        default: {
          heatingEF = metrics.heating[heatingData.heatingFuel];
          break;
        }
      }


      // heatingEF is the "Emission Factor" for heating. Takes the appropriate value based on the user's heating type from "emissionFactorsGlobal.heating".
      // const heatingEF = emissionFactorsGlobal.heating[userTestValues.heatingType as keyof typeof emissionFactorsGlobal.heating]
      const householdSize = userTestValues.householdSize;
      // calculation for the carbon emission. Simply takes the entered kWh value, divided by the number of people in the household, times the heating emission factor.
      return (value / householdSize) * heatingEF;
    }

    case "transportation": {
      let transportEF = 0;
      const transportationData = snapshot.after.data()?.transportation;
      const transportationType = transportationData.transportationType;
      const publicVehicleOccupancy = transportationData.publicVehicleOccupancy; // TODO: Implement types
      if (publicVehicleOccupancy) {
        transportEF = metrics.transportation[transportationType][publicVehicleOccupancy];
      }
      else {
        let privateVehicleOccupancy = transportationData.publicVehicleOccupancy;
        if (!privateVehicleOccupancy) {
          privateVehicleOccupancy = 1;
        }
        else if (privateVehicleOccupancy>5) {
          if (transportationType in ["motorcycle, electricMotorcycle"]) {
            privateVehicleOccupancy = 2;
          }
          else {
            privateVehicleOccupancy = 5;
          }
        }

        transportEF = metrics.transportation[transportationType][String(privateVehicleOccupancy)];

      }

      switch (transportationType) {
        case "plane":
        case "walking":
        case "bike": {
          transportEF = metrics.transportation[transportationType]
        }
      }
      // Since the transport Emission Factor is already in kg CO2 per km, it can simply be multiplied with the kilometer value.
      return value * transportEF;
    }

    case "electricity": {
      // electricityEF is the "Emission Factor" for electricity. Takes the appropriate value based on the user's site from "sites[site].electricity".
      const electricityEF = snapshot.after.data()?.heating.default
      const householdSize = userTestValues.householdSize;
      // calculation for the carbon emission. Simply takes the entered kWh value, divided by the number of people in the household, times the electricity emission factor.
      return (value / householdSize) * electricityEF;
    }
  }
  return 0.1337;
}

/**
 * [getTestValue]
 * This entire function only exists as a replacement for the Firebase implementation, which I dont know how to do.
 */

function getConsumptionDate(
  snapshot: functions.Change<functions.firestore.DocumentSnapshot>,
) {
  switch (snapshot.after.data()?.category) {
    case "heating":
    case "electricity": {
      return snapshot.after.data()?.startDate
    }
    case "transportation": {
      return snapshot.after.data()?.dateOfTravel
    }
  }
}


/*
async function getEmissionFactor(
  category: string, // transport, electricity, or heating
  consumptionDate: Timestamp, 
  subcategory: string, // Such as heating source or transport vehicle
  subsubcategory: string, // Only transport occupancy uses this
  country: string
): Promise<number> {

  // Retrieve the most recent country metric based on the consumptionDate using the property "country" of a user which contains the id of a document
  const metrics = (await admin.firestore()
    .collection("countries").doc(country)
    .collection("metrics")
    .where("validFrom", "<", consumptionDate)
    .orderBy("validFrom", "desc").limit(1)
    .get()
    .then(querySnapshot => {
      if(!querySnapshot.empty) {
        return querySnapshot.docs[0]
      }
      else { return null }; // TODO: add standard EU metrics as fallback?
    }));
  if (!metrics) {
    throw new Error("Country not found");
  }
  console.log(metrics);
  

  // let EFvalue = 0;

  switch (category) {
    case "electricity": {
      return metrics.data().electricity.default
    }

    case "transportation": {
      // select list of transportations by demosite
      const transportList = sites[site as keyof typeof sites].transportation;
      // select available occupancy levels for given transportation
      const transportOccupancy = transportList[subcategory as keyof typeof transportList];
      // select  Emission Factor for occupancy of transport type
      const transportEF = transportOccupancy[subsubcategory as keyof typeof transportOccupancy];

      return transportEF;
    }

    case "heating": {
      return metrics.data().heating[""]
    }
  }
}
*/