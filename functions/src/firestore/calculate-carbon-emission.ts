import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../utils/constants";
import * as Path from "path";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

/**
 * [calculateCarbonEmission]
 * A Cloud Function triggered by a document write in the consumptions sub-collection of a user.
 * This function will calculate the carbon emissions and write it to the corresponding property.
 */
export const calculateCarbonEmission = functions
  .region(preferredRegion)
  .firestore.document(Path.join(usersCollectionName, "userId", consumptionsCollectionName, "consumptionId"))
  .onWrite((snapshot, context) =>
    admin
      .firestore()
      .doc(
        Path.join(usersCollectionName, context.params.userId, consumptionsCollectionName, context.params.consumptionId)
      )
      .update("carbonEmissions", calculateCarbonEmissions(snapshot, context))
  );

/**
 * Calculate carbon emissions
 * @param snapshot The document snapshot.
 * @param context The event context.
 */
async function calculateCarbonEmissions(
  snapshot: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext<Record<string, string>>
): Promise<number> {
  // TODO: Correctly calculate carbon emissions
  return 0.79;
}
