import * as functions from "firebase-functions";

export default functions
  .region("europe-west1")
  .firestore.document("users/{userId}/consumptions/{consumptionId}")
  .onWrite(async (snapshot, context) => {
    // TODO: Calculate and Update Carbon Emission
    console.log(context.params.userId, context.params.consumptionId);
  });
