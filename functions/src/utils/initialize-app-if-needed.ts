import { apps } from "firebase-admin";
import { initializeApp } from "firebase-admin/app";

/**
 * Initializes the Firebase Admin SDK, if needed.
 */
export function initializeAppIfNeeded() {
  if (apps.length === 0) {
    initializeApp();
  }
}
