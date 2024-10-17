import { getFirestore } from "firebase-admin/firestore";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import { FirebaseConstants } from "../utils/firebase-constants";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

export const isAdmin = (userId: string): Promise<boolean> => {
  return firestore
    .collection(FirebaseConstants.collections.userRoles.name)
    .doc(userId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return doc.data()?.isAdmin;
      } else {
        return false;
      }
    });
};
