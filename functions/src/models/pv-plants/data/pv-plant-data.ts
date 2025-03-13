import type { Timestamp } from "firebase-admin/firestore";

/**
 * A PV data entry captured from an API
 */

export interface PvPlantData {
	/**
	 * The date
	 */
	date: Timestamp;
	/**
	 * The energy production in Wh
	 */
	Ep: number;
}
