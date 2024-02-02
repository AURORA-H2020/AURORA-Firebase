import { Timestamp } from "firebase-admin/firestore";

export interface BlacklistedUser {
  blacklistedReason?: string;
  blacklistedAt?: Timestamp;
}
