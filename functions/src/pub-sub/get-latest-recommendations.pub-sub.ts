/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import type { User } from "../models/user/user";
import { getRecommendations } from "../shared-functions/recommender/get-recommendations";
import { syncAllUserData } from "../shared-functions/recommender/sync-all-user-data";
import { FirebaseConstants } from "../utils/firebase-constants";
import { getDaysAgo } from "../utils/helpers";
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
			const { default: pMap } = await import("p-map");

			const usersSnapshots = await firestore
				.collection(FirebaseConstants.collections.users.name)
				.get();

			const data = usersSnapshots.docs.map((doc) => ({
				userId: doc.id,
				userData: doc.data() as User,
			}));

			const updaterFn = async ({
				userId,
				userData,
			}: {
				userId: string;
				userData: User;
			}) => {
				if (
					!userData.recommenderMeta?.lastFullSync?.seconds ||
					userData.recommenderMeta.lastFullSync.seconds <
						new Date("2025-07-28").getTime() / 1000
				) {
					console.log("Full sync needed for user: ", userId);

					// wait for 500 ms to avoid rate limiting
					await new Promise((resolve) => setTimeout(resolve, 500));

					console.log("Getting recommendations for user: ", userId);

					// We are intentionally skipping the getRecommendations call here as there won't be any recommendations available yet.
					return await syncAllUserData({
						userId,
						secrets: {
							recommenderApiToken: recommenderApiToken.value(),
							recommenderApiBaseUrl: recommenderApiBaseUrl.value(),
						},
					});
				}

				const getRecommendationsResult = await getRecommendations({
					userId,
					// This needs to match the execution interval of the pub/sub function
					filters: { after: getDaysAgo(1) },
					secrets: {
						recommenderApiToken: recommenderApiToken.value(),
						recommenderApiBaseUrl: recommenderApiBaseUrl.value(),
					},
				});

				return {
					...getRecommendationsResult,
					user: userId,
				};
			};

			const result = await pMap(data, updaterFn, {
				concurrency: 20,
				stopOnError: false,
			});

			console.log("Update recommendations result:", result);
			console.log("Successfull: ", result.filter((r) => r.success).length);
			console.log("Failed: ", result.filter((r) => !r.success).length);
		} catch (error) {
			throw new Error(`Error getting recommendations: ${error}`);
		}
	},
);
