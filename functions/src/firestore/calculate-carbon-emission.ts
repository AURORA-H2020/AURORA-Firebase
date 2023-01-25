import * as functions from "firebase-functions";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../constants";
import * as Path from "path";
import * as admin from "firebase-admin";

export default functions
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
