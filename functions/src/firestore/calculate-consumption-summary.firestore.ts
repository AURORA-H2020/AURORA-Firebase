import { region } from "firebase-functions";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../constants";
import * as Path from "path";

export default region(preferredRegion)
  .firestore.document(Path.join(usersCollectionName, "userId", consumptionsCollectionName, "consumptionId"))
  .onWrite(async (snapshot, context) => {
    // TODO: Calculate and Update Consumption Summary
    console.log(context.params.userId, context.params.consumptionId);
  });
