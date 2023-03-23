import { Timestamp } from "firebase-admin/firestore";

export interface MetaData {
  version?: string;
  lastRecalculation?: Timestamp;
}
