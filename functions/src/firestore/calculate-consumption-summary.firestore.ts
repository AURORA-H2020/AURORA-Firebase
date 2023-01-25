import { Change, EventContext, region } from "firebase-functions";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../constants";
import * as Path from "path";
import { firestore } from "firebase-admin";
import DocumentSnapshot = firestore.DocumentSnapshot;
import { ConsumptionSummary } from "../models/consumption-summary.model";

export default region(preferredRegion)
  .firestore.document(Path.join(usersCollectionName, "userId", consumptionsCollectionName, "consumptionId"))
  .onWrite(async (snapshot, context) =>
    firestore()
      .doc(Path.join(usersCollectionName, context.params.userId))
      .update("consumptionSummary", calculateConsumptionSummary(snapshot, context))
  );

/**
 * Calculate ConsumptionSummary
 * @param snapshot The document snapshot.
 * @param context The event context.
 */
async function calculateConsumptionSummary(
  snapshot: Change<DocumentSnapshot>,
  context: EventContext<Record<string, string>>
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
