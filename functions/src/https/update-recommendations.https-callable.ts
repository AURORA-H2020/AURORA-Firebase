import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { Consumption } from "../models/consumption/consumption";
import type { User } from "../models/user/user";
import { createRecommenderConsumptions } from "../shared-functions/recommender/create-recommender-consumptions";
import { createRecommenderUserIfNeeded } from "../shared-functions/recommender/create-recommender-user-if-needed";
import { getRecommendations } from "../shared-functions/recommender/get-recommendations";
import { runRecommenderEngine } from "../shared-functions/recommender/run-recommender-engine";
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
 * [updateRecommendations]
 * A HTTPS Callable Cloud Function.
 * This functions fetches all Recommendations for a user from an API and stores it in Firestore.
 * Triggered manually for testing.
 */
export const updateRecommendations = onCall(
	{ secrets: [recommenderApiToken, recommenderApiBaseUrl] },
	async (req) => {
		const auth = req.auth;

		if (!auth) {
			throw new HttpsError(
				"failed-precondition",
				"The function must be called while authenticated",
			);
		}

		const userDoc = (await firestore
			.collection(FirebaseConstants.collections.users.name)
			.doc(auth.uid)
			.get()) as FirebaseFirestore.QueryDocumentSnapshot<User>;

		const createUserRes = await createRecommenderUserIfNeeded({
			userId: userDoc.id,
			secrets: {
				recommenderApiToken: recommenderApiToken.value(),
				recommenderApiBaseUrl: recommenderApiBaseUrl.value(),
			},
		});

		if (!createUserRes.success) {
			return {
				success: false,
				error: createUserRes.error,
			};
		}

		const consumptionQuery = (await firestore
			.collection(FirebaseConstants.collections.users.name)
			.doc(userDoc.id)
			.collection(FirebaseConstants.collections.users.consumptions.name)
			.get()) as FirebaseFirestore.QuerySnapshot<Consumption>;

		const createConsumptionsRes = await createRecommenderConsumptions({
			userId: userDoc.id,
			consumptionDocs: consumptionQuery.docs,
			secrets: {
				recommenderApiToken: recommenderApiToken.value(),
				recommenderApiBaseUrl: recommenderApiBaseUrl.value(),
			},
		});

		if (!createConsumptionsRes.success) {
			return {
				success: false,
				error: createConsumptionsRes.error,
			};
		}

		const engineRunRes = await runRecommenderEngine({
			secrets: {
				recommenderApiToken: recommenderApiToken.value(),
				recommenderApiBaseUrl: recommenderApiBaseUrl.value(),
			},
		});

		if (!engineRunRes.success) {
			return {
				success: false,
				error: engineRunRes.error,
			};
		}

		const getRecsRes = await getRecommendations({
			userId: userDoc.id,
			filters: { after: new Date(0) },
			secrets: {
				recommenderApiToken: recommenderApiToken.value(),
				recommenderApiBaseUrl: recommenderApiBaseUrl.value(),
			},
		});

		if (!getRecsRes.success) {
			return {
				success: false,
				error: getRecsRes.error,
			};
		}

		return { success: true };
	},
);
