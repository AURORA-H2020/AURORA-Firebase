import * as functions from "firebase-functions";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../constants";
import * as admin from "firebase-admin";
import * as Path from "path";

export default functions.region(preferredRegion).https.onCall(async (data, context) => {
  // Check if auth is not available
  if (!context.auth) {
    // Throw failed precondition error
    throw new functions.https.HttpsError("failed-precondition", "The function must be called while authenticated");
  }
  // Retrieve user data
  const user = (await admin.firestore().doc(Path.join(usersCollectionName, context.auth.uid)).get()).data();
  // Check if user data is unavailable
  if (!user) {
    // Throw not found error
    throw new functions.https.HttpsError("not-found", "No user data available");
  }
  // Retrieve consumptions data
  const consumptions = (
    await admin
      .firestore()
      .collection(Path.join(usersCollectionName, context.auth.uid, consumptionsCollectionName))
      .get()
  ).docs.map((doc) => doc.data());
  // Return data
  return {
    user: user,
    consumptions: consumptions,
  };
});
