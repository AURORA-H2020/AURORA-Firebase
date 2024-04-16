import { Timestamp } from "firebase-admin/firestore";

import { BlacklistedReason } from "./blacklisted-reasons";

export interface BlacklistedUser {
  blacklistedReason?: BlacklistedReason;
  blacklistedAt?: Timestamp;
}
