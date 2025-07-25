/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import type { User } from "../models/user/user";
import { getRecommendations } from "../shared-functions/recommender/get-recommendations";
import { syncAllUserData } from "../shared-functions/recommender/sync-all-user-data";
import { FirebaseConstants } from "../utils/firebase-constants";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

// Get API token and URL from Secret Manager
const recommenderApiToken = defineSecret("RECOMMENDER_API_TOKEN");
const recommenderApiBaseUrl = defineSecret("RECOMMENDER_API_BASE_URL");

/**
 * [getLatestRecommendations]
 * A Cloud Function which is triggered by a pub/sub every day at 01:00.
 * It gets the latest recommendations for all users.
 */
export const getLatestRecommendations = onSchedule(
	{
		schedule: "every day 01:00",
		timeZone: "Europe/Berlin",
		timeoutSeconds: 360,
		secrets: [recommenderApiToken, recommenderApiBaseUrl],
	},
	async () => {
		try {
			const usersSnapshots = await firestore
				.collection(FirebaseConstants.collections.users.name)
				.get();

			for (const doc of usersSnapshots.docs) {
				// Check if property exists on user, if not full sync is needed.
				const userData = doc.data() as User;

				if (!userData.recommenderMeta?.lastFullSync) {
					console.log(
						"Full sync needed for user: ",
						doc.id,
						" - lastFullSync not found",
					);

					syncAllUserData({
						userId: doc.id,
						secrets: {
							recommenderApiToken: recommenderApiToken.value(),
							recommenderApiBaseUrl: recommenderApiBaseUrl.value(),
						},
					});
				}

				console.log("Getting recommendations for user: ", doc.id);

				await getRecommendations({
					userId: doc.id,
					filters: { after: new Date() }, // TODO: Add filter for current date
					secrets: {
						recommenderApiToken: recommenderApiToken.value(),
						recommenderApiBaseUrl: recommenderApiBaseUrl.value(),
					},
				});
			}
		} catch (error) {
			throw new Error(`Error getting recommendations: ${error}`);
		}
	},
);
