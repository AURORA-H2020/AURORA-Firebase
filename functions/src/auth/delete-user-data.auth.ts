import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { preferredRegion, usersCollectionName } from "../constants";

export default functions
  .region(preferredRegion)
  .auth.user()
  .onDelete(async (user) => {
    console.log("Deleting user data", user.uid);
    const bulkWriter = admin.firestore().bulkWriter();
    const maximumRetryAttempts = 3;
    bulkWriter.onWriteError((error) => {
      if (error.failedAttempts < maximumRetryAttempts) {
        return true;
      } else {
        console.error("Failed to delete user data at:", error.documentRef.path);
        return false;
      }
    });
    await admin
      .firestore()
      .recursiveDelete(admin.firestore().collection(usersCollectionName).doc(user.uid), bulkWriter);
    console.log("Successfully deleted user data", user.uid);
  });
