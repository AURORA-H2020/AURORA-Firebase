import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FirebaseConstants } from "../utils/firebase-constants";
import { discardError } from "../utils/discard-error";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

/**
 * [downloadUserData]
 * A HTTPS Callable Cloud Function.
 * This functions aggregates all Firestore documents which are associated with the user
 * and responds a JSON object containing the relevant information.
 */
export const downloadUserData = onCall(async (request) => {
  // Initialize auth from request
  const auth = request.auth;
  // Check if auth is not available
  if (!auth) {
    // Throw failed precondition error
    throw new HttpsError("failed-precondition", "The function must be called while authenticated");
  }
  // Retrieve user data
  const user = (
    await admin.firestore().collection(FirebaseConstants.collections.users.name).doc(auth.uid).get()
  ).data();
  // Check if user data is unavailable
  if (!user) {
    // Throw not found error
    throw new HttpsError("not-found", "No user data available");
  }
  // Retrieve consumptions
  const consumptions =
    (
      await discardError(() =>
        admin
          .firestore()
          .collection(FirebaseConstants.collections.users.name)
          .doc(auth.uid)
          .collection(FirebaseConstants.collections.users.consumptions.name)
          .get()
      )
    )?.docs.map((doc) => doc.data()) ?? [];
  // Retrieve consumption summaries
  const consumptionSummaries =
    (
      await discardError(() =>
        admin
          .firestore()
          .collection(FirebaseConstants.collections.users.name)
          .doc(auth.uid)
          .collection(FirebaseConstants.collections.users.consumptionSummaries.name)
          .get()
      )
    )?.docs.map((doc) => doc.data()) ?? [];
  // Retrieve recurring consumptions
  const recurringConsumptions =
    (
      await discardError(() =>
        admin
          .firestore()
          .collection(FirebaseConstants.collections.users.name)
          .doc(auth.uid)
          .collection(FirebaseConstants.collections.users.recurringConsumptions.name)
          .get()
      )
    )?.docs.map((doc) => doc.data()) ?? [];
  // Return data
  return {
    user: user,
    consumptions: consumptions,
    consumptionSummaries: consumptionSummaries,
    recurringConsumptions: recurringConsumptions,
  };
});
