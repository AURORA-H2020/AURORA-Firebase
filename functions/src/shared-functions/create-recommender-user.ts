import axios, { type AxiosResponse } from "axios";
import type { User } from "../models/user/user";
import { FirebaseConstants } from "../utils/firebase-constants";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import { getFirestore } from "firebase-admin/firestore";
import type { Country } from "../models/country/country";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

export const createRecommenderUser = async ({
	userDoc,
	secrets,
}: {
	userDoc: FirebaseFirestore.QueryDocumentSnapshot<User>;
	secrets: { recommenderApiToken: string; recommenderApiBaseUrl: string };
}) => {
	const apiToken = secrets.recommenderApiToken;
	const apiUrl = `${secrets.recommenderApiBaseUrl}/api/user/${userDoc.id}`;

	const userCountryDoc = (await firestore
		.collection(FirebaseConstants.collections.countries.name)
		.doc(userDoc.data().country)
		.get()) as FirebaseFirestore.QueryDocumentSnapshot<Country>;

	const data = JSON.stringify({
		id: userDoc.id,
		country: userCountryDoc.data().countryCode.toLowerCase(),
		yearOfBirth: userDoc.data().yearOfBirth,
		householdProfile: userDoc.data().householdProfile,
		gender: userDoc.data().gender,
		creationTime: new Date().getTime(),
	});

	console.log("Creating recommender user: ", data);

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
			error: `Failed to create recommender user: ${response.status} ${response.statusText}`,
		};
	}
	return {
		success: true,
	};
};
