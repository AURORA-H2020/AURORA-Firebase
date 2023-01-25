import { initializeApp } from "firebase-admin/app";
import calculateCarbonEmissionFirestore from "./firestore/calculate-carbon-emission";
import deleteUserDataAuth from "./auth/delete-user-data";
import downloadUserDataHttps from "./https/download-user-data";
import calculateConsumptionSummaryFirestore from "./firestore/calculate-consumption-summary";

// Initialize Firebase Admin SDK
initializeApp();

/**
 * Auth Cloud Functions
 */

// Delete user data on Firebase user account deletion
exports.deleteUserData = deleteUserDataAuth;

/**
 * Firestore Cloud Functions
 */

// Calculate Carbon Emission Firestore Cloud Function
exports.calculateCarbonEmission = calculateCarbonEmissionFirestore;

// Calculate Consumption Summary Firestore Cloud Function
exports.calculateConsumptionSummary = calculateConsumptionSummaryFirestore;

/**
 * HTTPS Cloud Functions
 */

// Download user data HTTPS Callable Cloud Function
exports.downloadUserData = downloadUserDataHttps;
