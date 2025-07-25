import { setGlobalOptions } from "firebase-functions/v2";
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
export * from "./firestore/calculate-carbon-emissions-v2.firestore";
export * from "./firestore/calculate-investment.firestore";

/**
 * HTTPS Cloud Functions
 */
export * from "./https/download-user-data.https-callable";
export * from "./https/get-all-api-data.https-callable";

/**
 * Pub/Sub Cloud Functions
 */
export * from "./pub-sub/process-recurring-consumptions.pub-sub";
export * from "./pub-sub/export-user-data.pub-sub";
export * from "./pub-sub/get-daily-api-data.pub-sub";
export * from "./pub-sub/calculate-pv-investment-consumptions.pub-sub";
