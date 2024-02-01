import { App, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Initializes the Firebase Admin SDK, if needed.
 */
export function initializeAppIfNeeded(): App {
  // Retrieve apps
  const apps = getApps();
  // Check if no apps are available
  if (apps.length === 0) {
    // Initialize app
    const app = initializeApp();

    // Configure Firestore for emulator if running in emulator environment
    if (process.env.FUNCTIONS_EMULATOR) {
      getFirestore().settings({
        host: "localhost:8080",
        ssl: false,
        ignoreUndefinedProperties: true,
      });
    } else {
      // Globally configure Firestore once to ignore undefined properties.
      // Firestore is not capable of handling undefined values as only null values are allowed.
      // But TypeScript prefers the usage of undefined over null!
      // Read more: https://github.com/Microsoft/TypeScript/wiki/Coding-guidelines#null-and-undefined
      getFirestore().settings({ ignoreUndefinedProperties: true });
    }

    // Initialize Firebase Storage
    getStorage();

    // Return app
    return app;
  } else {
    // Return first app
    return apps[0];
  }
}
