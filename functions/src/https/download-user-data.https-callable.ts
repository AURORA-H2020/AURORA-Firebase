import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FirebaseConstants } from "../utils/firebase-constants";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

/**
 * [downloadUserData]
 * A HTTPS Callable Cloud Function.
 * This functions aggregates all Firestore documents which are associated with the user
 * and responds a JSON object containing the relevant information.
 */
export const downloadUserData = onCall(async (request) => {
  // Check if auth is not available
  if (!request.auth) {
    // Throw failed precondition error
    throw new HttpsError("failed-precondition", "The function must be called while authenticated");
  }
  // Retrieve user data
  const user = (
    await admin.firestore().collection(FirebaseConstants.collections.users.name).doc(request.auth.uid).get()
  ).data();
  // Check if user data is unavailable
  if (!user) {
    // Throw not found error
    throw new HttpsError("not-found", "No user data available");
  }
  // Retrieve consumptions data
  const consumptions = (
    await admin
      .firestore()
      .collection(FirebaseConstants.collections.users.name)
      .doc(request.auth.uid)
      .collection(FirebaseConstants.collections.users.consumptions.name)
      .get()
  ).docs.map((doc) => doc.data());
  // Retrieve consumption-summary data
  const consumptionSummary = (
    await admin
      .firestore()
      .collection(FirebaseConstants.collections.users.name)
      .doc(request.auth.uid)
      .collection(FirebaseConstants.collections.users.consumptionSummaries.name)
      .get()
  ).docs.map((doc) => doc.data());
  // Return data
  return {
    user: user,
    consumptions: consumptions,
    consumptionSummary: consumptionSummary,
  };
});
