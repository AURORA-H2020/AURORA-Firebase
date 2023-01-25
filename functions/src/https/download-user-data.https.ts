import { region } from "firebase-functions";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../constants";
import { HttpsError } from "firebase-functions/lib/common/providers/https";
import { firestore } from "firebase-admin";
import * as Path from "path";

export default region(preferredRegion).https.onCall(async (data, context) => {
  // Check if auth is not available
  if (!context.auth) {
    // Throw error
    throw new HttpsError("failed-precondition", "The function must be called while authenticated");
  }
  // Retrieve user data
  const user = (await firestore().doc(Path.join(usersCollectionName, context.auth.uid)).get()).data();
  // Check if user data is unavailable
  if (!user) {
    // Throw error
    throw new HttpsError("not-found", "No user data available");
  }
  // Retrieve consumptions data
  const consumptions = (
    await firestore().collection(Path.join(usersCollectionName, context.auth.uid, consumptionsCollectionName)).get()
  ).docs.map((doc) => doc.data());
  // Return data
  return {
    user: user,
    consumptions: consumptions,
  };
});
