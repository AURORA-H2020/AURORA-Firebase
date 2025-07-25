import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { Consumption } from "../../models/consumption/consumption";
import { FirebaseConstants } from "../../utils/firebase-constants";
import { initializeAppIfNeeded } from "../../utils/initialize-app-if-needed";
import { createRecommenderConsumptions } from "./create-recommender-consumptions";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

export const syncAllUserData = async ({
	userId,
	secrets,
}: {
	userId: string;
	secrets: { recommenderApiToken: string; recommenderApiBaseUrl: string };
}) => {
	const consumptionQuery = (await firestore
		.collection(FirebaseConstants.collections.users.name)
		.doc(userId)
		.collection(FirebaseConstants.collections.users.consumptions.name)
		.get()) as FirebaseFirestore.QuerySnapshot<Consumption>;

	const createConsumptionsRes = await createRecommenderConsumptions({
		userId,
		consumptionDocs: consumptionQuery.docs,
		secrets: {
			recommenderApiToken: secrets.recommenderApiToken,
			recommenderApiBaseUrl: secrets.recommenderApiBaseUrl,
		},
	});

	if (!createConsumptionsRes.success) {
		return {
			success: false,
			error: createConsumptionsRes.error,
		};
	}

	// Write lastFullSync timestamp to user document
	await firestore
		.collection(FirebaseConstants.collections.users.name)
		.doc(userId)
		.update({
			recommenderMeta: {
				lastFullSync: Timestamp.now(),
			},
		});

	return {
		success: true,
	};
};
