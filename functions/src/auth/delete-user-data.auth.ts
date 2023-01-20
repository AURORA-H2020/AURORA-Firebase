import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { preferredRegion, usersCollectionName } from "../constants";

export default functions
  .region(preferredRegion)
  .auth.user()
  .onDelete((user) =>
    admin.firestore().recursiveDelete(admin.firestore().collection(usersCollectionName).doc(user.uid))
  );
