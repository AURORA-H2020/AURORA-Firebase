import { Timestamp } from "firebase-admin/firestore";

/**
 * A user consumption metadata
 */
export interface UserConsumptionMetadata {
  /**
   * The version
   */
  version?: string;
  /**
   * The last recalculation date
   */
  lastRecalculation?: Timestamp;
}
