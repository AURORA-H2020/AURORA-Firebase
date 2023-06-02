import { setGlobalOptions } from "firebase-functions/lib/v2";
import { FirebaseConstants } from "./utils/firebase-constants";

// Use preferred cloud function region
setGlobalOptions({ region: FirebaseConstants.preferredCloudFunctionRegion });

/**
 * Auth Cloud Functions
 */
export * from "./auth/delete-user-data.auth";

/**
 * Firestore Cloud Functions
 */
export * from "./firestore/calculate-carbon-emission.firestore";

/**
 * HTTPS Cloud Functions
 */
export * from "./https/download-user-data.https-callable";

/**
 * Pub/Sub Cloud Functions
 */
export * from "./pub-sub/process-recurring-consumptions.pub-sub";
