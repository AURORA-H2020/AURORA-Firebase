import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../utils/constants";
import * as Path from "path";

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

  const consumptionType = snapshot.category
  let carbonEmission = 0.1

  switch (consumptionType) {
    case "heating":
      carbonEmission = 1.5;
      break;

    case "transportation":
      carbonEmission =  1.0;
      break;

    case "electricity":
      carbonEmission =  0.5;
      break;
      
    default:
      break;

  }
  return carbonEmission;
}
