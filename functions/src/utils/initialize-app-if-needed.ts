import { App, getApps, initializeApp } from "firebase-admin/app";

/**
 * Initializes the Firebase Admin SDK, if needed.
 */
export function initializeAppIfNeeded(): App {
  const apps = getApps();
  return apps.length === 0 ? initializeApp() : apps[0];
}
