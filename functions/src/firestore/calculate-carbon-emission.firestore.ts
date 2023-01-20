import * as functions from "firebase-functions";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../constants";
import * as Path from "path";

export default functions
  .region(preferredRegion)
  .firestore.document(Path.join(usersCollectionName, "userId", consumptionsCollectionName, "consumptionId"))
  .onWrite(async (snapshot, context) => {
    // TODO: Calculate and Update Carbon Emission
    console.log(context.params.userId, context.params.consumptionId);
  });
