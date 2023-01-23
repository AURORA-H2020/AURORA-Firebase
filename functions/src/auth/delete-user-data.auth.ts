import { region } from "firebase-functions";
import { firestore } from "firebase-admin";
import { preferredRegion, usersCollectionName } from "../constants";

export default region(preferredRegion)
  .auth.user()
  .onDelete(async (user) => {
    console.log("Deleting user data", user.uid);
    const bulkWriter = firestore().bulkWriter();
    const maximumRetryAttempts = 3;
    bulkWriter.onWriteError((error) => {
      if (error.failedAttempts < maximumRetryAttempts) {
        return true;
      } else {
        console.error("Failed to delete user data at:", error.documentRef.path);
        return false;
      }
    });
    await firestore().recursiveDelete(firestore().collection(usersCollectionName).doc(user.uid), bulkWriter);
    console.log("Successfully deleted user data", user.uid);
  });
