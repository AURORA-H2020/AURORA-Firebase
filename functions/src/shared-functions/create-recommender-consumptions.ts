import axios, { type AxiosResponse } from "axios";
import { getFirestore } from "firebase-admin/firestore";
import type { User } from "../models/user/user";
import { FirebaseConstants } from "../utils/firebase-constants";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

export const createRecommenderConsumptions = async ({
	userDoc,
	secrets,
}: {
	userDoc: FirebaseFirestore.QueryDocumentSnapshot<User>;
	secrets: { recommenderApiToken: string; recommenderApiBaseUrl: string };
}) => {
	const apiToken = secrets.recommenderApiToken;
	const apiUrl = `${secrets.recommenderApiBaseUrl}/api/user/${userDoc.id}/auroraconsumptions`;

	const userConsumptionDocs = await firestore
		.collection(FirebaseConstants.collections.users.name)
		.doc(userDoc.id)
		.collection(FirebaseConstants.collections.users.consumptions.name)
		.get();

	const data = userConsumptionDocs.docs.map((doc) => ({
		id: doc.id,
		...doc.data(),
	}));

	console.log("Adding recommender consumptions: ", data.length);

	const response = (await axios({
		method: "post",
		url: apiUrl,
		data,
		headers: {
			Authorization: `Bearer ${apiToken}`,
		},
	})) as AxiosResponse;

	if (response.status !== 201) {
		return {
			success: false,
			error: `Failed to create recommender consumptions: ${response.status} ${response.statusText}`,
		};
	}
	return {
		success: true,
	};
};
