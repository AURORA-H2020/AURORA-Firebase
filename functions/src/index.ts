import { initializeApp } from "firebase-admin";
import calculateCarbonEmissionFirestore from "./firestore/calculate-carbon-emission.firestore";
import deleteUserDataAuth from "./auth/delete-user-data.auth";
import downloadUserDataHttps from "./https/download-user-data.https";
import calculateConsumptionSummaryFirestore from "./firestore/calculate-consumption-summary.firestore";

// Initialize Firebase Admin SDK
initializeApp();

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

// Calculate Consumption Summary Firestore Cloud Function
exports["calculate-consumption-summary"] = calculateConsumptionSummaryFirestore;

/**
 * HTTPS Cloud Functions
 */

// Download user data HTTPS Callable Cloud Function
exports["download-user-data"] = downloadUserDataHttps;
