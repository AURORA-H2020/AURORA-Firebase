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
  // TODO: Correctly calculate consumption summary
  return {
    totalCarbonEmissions: 0.79,
    entries: [
      {
        category: "electricity",
        value: 0.29,
      },
      {
        category: "transportation",
        value: 0.27,
      },
      {
        category: "heating",
        value: 0.44,
      },
    ],
  };
}
