import { Change, EventContext, region } from "firebase-functions";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../constants";
import * as Path from "path";
import { firestore } from "firebase-admin";
import DocumentSnapshot = firestore.DocumentSnapshot;

export default region(preferredRegion)
  .firestore.document(Path.join(usersCollectionName, "userId", consumptionsCollectionName, "consumptionId"))
  .onWrite((snapshot, context) =>
    firestore()
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
  snapshot: Change<DocumentSnapshot>,
  context: EventContext<Record<string, string>>
): Promise<number> {
  // TODO: Calculate carbon emission
  return 0.79;
}
