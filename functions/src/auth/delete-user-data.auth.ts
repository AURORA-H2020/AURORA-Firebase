import * as functions from "firebase-functions";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import { FirebaseConstants } from "../utils/firebase-constants";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

/**
 * [deleteUserData]
 * A Cloud Function which gets triggered when a user has been deleted.
 * This function will clean up all Firestore documents and collection
 * associated with the deleted user.
 */
export const deleteUserData = functions
  .region(FirebaseConstants.preferredCloudFunctionRegion)
  .auth.user()
  .onDelete(async (user) => {
    console.log("Deleting user data", user.uid);
    const firestore = getFirestore();
    const bulkWriter = firestore.bulkWriter();
    const maximumRetryAttempts = 3;
    bulkWriter.onWriteError((error) => {
      if (error.failedAttempts < maximumRetryAttempts) {
        return true;
      } else {
        console.error("Failed to delete user data at:", error.documentRef.path);
        return false;
      }
    });
    await firestore.recursiveDelete(
      firestore.collection(FirebaseConstants.collections.users.name).doc(user.uid),
      bulkWriter
    );
    console.log("Successfully deleted user data", user.uid);
  });
