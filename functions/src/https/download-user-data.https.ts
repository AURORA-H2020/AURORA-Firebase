import { region } from "firebase-functions";
import { consumptionsCollectionName, preferredRegion, usersCollectionName } from "../constants";
import { HttpsError } from "firebase-functions/lib/common/providers/https";
import { firestore } from "firebase-admin";
import * as Path from "path";

export default region(preferredRegion).https.onCall(async (data, context) => {
  const auth = context.auth;
  if (!auth) {
    throw new HttpsError("failed-precondition", "The function must be called while authenticated");
  }
  const user = (await firestore().doc(Path.join(usersCollectionName, auth.uid)).get()).data();
  if (!user) {
    throw new HttpsError("not-found", "No user data available");
  }
  const consumptions = (
    await firestore().collection(Path.join(usersCollectionName, auth.uid, consumptionsCollectionName)).get()
  ).docs.map((doc) => doc.data());
  return {
    user: user,
    consumptions: consumptions,
  };
});
