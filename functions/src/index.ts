import { initializeApp } from "firebase-admin";
// eslint-disable-next-line max-len
import calculateCarbonEmissionFirestore from "./firestore/calculate-carbon-emission.firestore";

// Initialize Firebase Admin SDK
initializeApp({
  credential: JSON.parse(process.env.FIREBASE_TOKEN ?? ""),
});

// Calculate Carbon Emission Firestore Cloud Function
exports.calculateCarbonEmission = calculateCarbonEmissionFirestore;
