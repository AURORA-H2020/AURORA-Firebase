import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../utils/constants";
import * as Path from "path";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

/**
 * [downloadUserData]
 * A HTTPS Callable Cloud Function.
 * This functions aggregates all Firestore documents which are associated with the user
 * and responds a JSON object containing the relevant information.
 */
export const downloadUserData = functions
  .region(preferredRegion)
  .runWith({
    // TODO: Enable as soon AppCheck is enabled in the apps
    enforceAppCheck: false,
  })
  .https.onCall(async (data, context) => {
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
