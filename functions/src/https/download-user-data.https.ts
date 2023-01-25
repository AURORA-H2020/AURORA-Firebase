import { region, https } from "firebase-functions";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../constants";
import { firestore } from "firebase-admin";
import * as Path from "path";

export default region(preferredRegion).https.onCall(async (data, context) => {
  // Check if auth is not available
  if (!context.auth) {
    // Throw failed precondition error
    throw new https.HttpsError("failed-precondition", "The function must be called while authenticated");
  }
  // Retrieve user data
  const user = (await firestore().doc(Path.join(usersCollectionName, context.auth.uid)).get()).data();
  // Check if user data is unavailable
  if (!user) {
    // Throw not found error
    throw new https.HttpsError("not-found", "No user data available");
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
