import { initializeApp } from "firebase-admin";
// eslint-disable-next-line max-len
import calculateCarbonEmissionFirestore from "./firestore/calculate-carbon-emission.firestore";
import deleteUserDataAuth from "./auth/delete-user-data.auth";

// Initialize Firebase Admin SDK
initializeApp({
  credential: JSON.parse(process.env.FIREBASE_TOKEN ?? ""),
});

/**
 * Auth Cloud Functions
 */

// Delete user data on Firebase user account deletion
exports["delete-user-data"] = deleteUserDataAuth;

/**
 * Firestore Cloud Functions
 */

// Calculate Carbon Emission Firestore Cloud Function
exports["calculate-carbon-emission"] = calculateCarbonEmissionFirestore;
