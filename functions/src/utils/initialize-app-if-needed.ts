import { App, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Initializes the Firebase Admin SDK, if needed.
 */
export function initializeAppIfNeeded(): App {
  const apps = getApps();
  if (apps.length === 0) {
    const app = initializeApp();
    getFirestore().settings({ ignoreUndefinedProperties: true });
    return app;
  } else {
    return apps[0];
  }
}
