import * as admin from "firebase-admin";

/**
 * Initializes the Firebase Admin SDK, if needed.
 */
export function initializeAppIfNeeded(): admin.app.App | null {
  return admin.apps.length === 0 ? admin.initializeApp() : admin.apps[0];
}
