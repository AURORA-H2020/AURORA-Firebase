import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../utils/constants";
import * as Path from "path";
import { ConsumptionSummary } from "../models/consumption-summary/consumption-summary";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

/**
 * [calculateConsumptionSummary]
 * A Cloud Function triggered by a document write in the consumptions sub-collection of a user.
 * This function will calculate the consumption summary and write it to the corresponding property.
 */
export const calculateConsumptionSummary = functions
  .region(preferredRegion)
  .firestore.document(Path.join(usersCollectionName, "{userId}", consumptionsCollectionName, "{consumptionId}"))
  .onWrite(async (snapshot, context) => {
    const calculatedConsumptionSummary = await consumptionSummary(snapshot, context);
    await admin
      .firestore()
      .doc(Path.join(usersCollectionName, context.params.userId))
      .update({ consumptionSummary: calculatedConsumptionSummary });
  });

/**
 * Calculate ConsumptionSummary
 * @param snapshot The document snapshot.
 * @param context The event context.
 */
async function consumptionSummary(
  snapshot: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext<Record<string, string>>
): Promise<ConsumptionSummary> {
  const user = (await admin.firestore().collection("users").doc(context.params.userId).get()).data();

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

function newConsumptionSummary() {
  const newConsumptionSummary: ConsumptionSummary = {
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
  return newConsumptionSummary;
}
