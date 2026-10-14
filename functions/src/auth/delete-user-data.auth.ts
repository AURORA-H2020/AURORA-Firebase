import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onUserDeleted } from "firebase-functions/v2/identity";
import { deleteRecommenderUser } from "../shared-functions/recommender/delete-recommender-user";
import { FirebaseConstants } from "../utils/firebase-constants";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

// Define secrets
const recommenderApiToken = defineSecret("RECOMMENDER_API_TOKEN");
const recommenderApiBaseUrl = defineSecret("RECOMMENDER_API_BASE_URL");

/**
 * [deleteUserDataV2]
 * A Cloud Function which gets triggered when a user has been deleted.
 * This function will clean up all Firestore documents and collection
 * associated with the deleted user.
 * Event delivery is at-least-once, which is safe as deleting already deleted data is a no-op.
 * Failed invocations are retried so that a transient error does not leave user data behind.
 */
export const deleteUserDataV2 = onUserDeleted(
	{
		secrets: [recommenderApiToken, recommenderApiBaseUrl],
		retry: true,
	},
	async (event) => {
		const user = event.data;
		console.log("Deleting user data", user.uid);
		const bulkWriter = firestore.bulkWriter();
		const maximumRetryAttempts = 3;
		bulkWriter.onWriteError((error) => {
			if (error.failedAttempts < maximumRetryAttempts) {
				return true;
			}
			console.error("Failed to delete user data at:", error.documentRef.path);
			return false;
		});
		// Delete all user data from Firestore
		await firestore.recursiveDelete(
			firestore
				.collection(FirebaseConstants.collections.users.name)
				.doc(user.uid),
			bulkWriter,
		);

		// Delete user data from recommender system
		await deleteRecommenderUser({
			userId: user.uid,
			secrets: {
				recommenderApiToken: recommenderApiToken.value(),
				recommenderApiBaseUrl: recommenderApiBaseUrl.value(),
			},
		});

		console.log("Successfully deleted user data", user.uid);
	},
);
