import axios, { type AxiosResponse } from "axios";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { FirebaseConstants } from "../../utils/firebase-constants";
import { initializeAppIfNeeded } from "../../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

interface RecommenderApiResponse {
	id: string;
	type: string;
	lan: string;
	title: string;
	message: string;
	rationale: string;
	user: string;
	priority: number;
	creationTime: number;
	deliveredTime: number;
}

export const getRecommendations = async ({
	userId,
	filters,
	secrets,
}: {
	userId: string;
	filters: {
		after: Date;
	};
	secrets: { recommenderApiToken: string; recommenderApiBaseUrl: string };
}) => {
	const timeAfterSeconds = Math.floor(filters.after.getTime() / 1000);

	const apiUrl = `${secrets.recommenderApiBaseUrl}/api/user/${userId}/recs?after=${timeAfterSeconds}`;

	try {
		const response = (await axios({
			method: "GET",
			url: apiUrl,
			headers: {
				Authorization: `Bearer ${secrets.recommenderApiToken}`,
			},
		})) as AxiosResponse<RecommenderApiResponse[] | undefined>;

		if (!response.data) {
			return {
				success: false,
				error:
					"Error fetching recommendations from the API or no recommendations found.",
			};
		}

		response.data.map((entry) => {
			firestore
				.collection(FirebaseConstants.collections.users.name)
				.doc(userId)
				.collection(FirebaseConstants.collections.users.recommendations.name)
				.doc(entry.id)
				.set({
					id: entry.id,
					type: entry.type,
					lan: entry.lan,
					title: entry.title,
					createdAt: new Date(entry.creationTime * 1000),
					updatedAt: Timestamp.now(),
					notifyAt: new Date(entry.deliveredTime * 1000),
					message: entry.message,
					rationale: entry.rationale,
					priority: entry.priority,
					isRead: false,
				});
		});
	} catch (error) {
		console.error("Error fetching recommendations:", error);
		return { success: false, error };
	}

	return { success: true };
};
