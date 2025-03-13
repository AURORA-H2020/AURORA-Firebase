import type { Timestamp } from "firebase-admin/firestore";
import type { BlacklistedReason } from "./blacklisted-reasons";

export interface BlacklistedUser {
	/**
	 * The reason why the user is blacklisted
	 * @see {@link BlacklistedReason}
	 */
	blacklistedReason?: BlacklistedReason;
	/**
	 * The date the user was blacklisted
	 */
	blacklistedAt?: Timestamp;
}
