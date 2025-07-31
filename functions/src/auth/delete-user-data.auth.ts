import { getFirestore } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
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
 * [deleteUserData]
 * A Cloud Function which gets triggered when a user has been deleted.
 * This function will clean up all Firestore documents and collection
 * associated with the deleted user.
 */
export const deleteUserData = functions
	.region(FirebaseConstants.preferredCloudFunctionRegion)
	.runWith({
		secrets: [recommenderApiToken, recommenderApiBaseUrl],
	})
	.auth.user()
	.onDelete(async (user) => {
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
		// TODO: Reenable this when recommender system is ready
		/* await deleteRecommenderUser({
			userId: user.uid,
			secrets: {
				recommenderApiToken: recommenderApiToken.value(),
				recommenderApiBaseUrl: recommenderApiBaseUrl.value(),
			},
		}); */

		console.log("Successfully deleted user data", user.uid);
	});
