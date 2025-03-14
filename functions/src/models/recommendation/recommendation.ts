import type { Timestamp } from "firebase-admin/firestore";

/**
 * A recommendation for improving the user's energy behavior
 */
export interface Recommendation {
	/**
	 * The notification ID as provided by the recommender system
	 */
	id: string;
	/**
	 * The recomendation type as provided by the recommender system
	 */
	type: string;
	/**
	 * The creation date
	 */
	createdAt: Timestamp;
	/**
	 * The last updated date
	 */
	updatedAt?: Timestamp;
	/**
	 * When the push notification should be sent
	 */
	notifyAt?: Timestamp;
	/**
	 * The title of the recommendation
	 */
	title?: string;
	/**
	 * The recommendation message
	 */
	message: string;
	/**
	 * The rationale for sending the recommendation
	 */
	rationale: string;
	/**
	 * The priority of the recommendation
	 */
	priority: number;
	/**
	 * Optional link to an external resource
	 */
	link?: string;
	/**
	 * Whether the recommendation has been read
	 */
	isRead?: boolean;
}
