import axios, { type AxiosResponse } from "axios";
import { getFirestore } from "firebase-admin/firestore";
import type { Country } from "../../models/country/country";
import type { User } from "../../models/user/user";
import { FirebaseConstants } from "../../utils/firebase-constants";
import { initializeAppIfNeeded } from "../../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

export const createRecommenderUserIfNeeded = async ({
	userId,
	secrets,
}: {
	userId: string;
	secrets: { recommenderApiToken: string; recommenderApiBaseUrl: string };
}) => {
	try {
		// Validate required parameters
		if (!userId) {
			console.warn("createRecommenderUser: Invalid user document provided");
			return { success: false, error: "Invalid user document" };
		}

		if (!secrets?.recommenderApiToken || !secrets?.recommenderApiBaseUrl) {
			console.warn("createRecommenderUser: Missing required secrets");
			return { success: false, error: "Missing required secrets" };
		}

		const apiToken = secrets.recommenderApiToken;
		const apiUrl = `${secrets.recommenderApiBaseUrl}/api/user/${userId}`;

		// Check if user already exists in recommender system
		const userExistsResult = await checkIfUserExists(apiUrl, apiToken);

		if (userExistsResult.error) {
			console.error(
				"createRecommenderUser: Error checking user existence:",
				userExistsResult.error,
			);
			return {
				success: false,
				error: `Failed to check user existence: ${userExistsResult.error}`,
			};
		}

		if (userExistsResult.exists) {
			console.log("User already exists in recommender system: ", userId);
			return {
				success: true,
				message: "User already exists in recommender system",
			};
		}

		console.log("Creating recommender user for: ", userId);

		// Fetch user document from Firestore
		const userDoc = (await firestore
			.collection(FirebaseConstants.collections.users.name)
			.doc(userId)
			.get()) as FirebaseFirestore.QueryDocumentSnapshot<User>;
		if (!userDoc.exists) {
			console.warn(`createRecommenderUser: User document not found: ${userId}`);
			return { success: false, error: "User document not found" };
		}

		// Validate user data before proceeding
		const userData = userDoc.data();
		if (!userData) {
			console.warn("createRecommenderUser: No user data found");
			return { success: false, error: "No user data found" };
		}

		if (!userData.country) {
			console.warn("createRecommenderUser: User missing country data");
			return { success: false, error: "User missing country data" };
		}

		// Get country information
		let userCountryDoc: FirebaseFirestore.QueryDocumentSnapshot<Country>;
		try {
			const countryDocRef = (await firestore
				.collection(FirebaseConstants.collections.countries.name)
				.doc(userData.country)
				.get()) as FirebaseFirestore.QueryDocumentSnapshot<Country>;

			if (!countryDocRef.exists) {
				console.warn(
					`createRecommenderUser: Country document not found: ${userData.country}`,
				);
				return { success: false, error: "Country not found" };
			}

			userCountryDoc =
				countryDocRef as FirebaseFirestore.QueryDocumentSnapshot<Country>;
		} catch (error) {
			console.error(
				"createRecommenderUser: Error fetching country data:",
				error,
			);
			return { success: false, error: "Failed to fetch country data" };
		}

		const countryData = userCountryDoc.data();
		if (!countryData?.countryCode) {
			console.warn("createRecommenderUser: Country missing countryCode");
			return { success: false, error: "Country missing country code" };
		}

		// Prepare user data for API
		const apiUserData = {
			id: userDoc.id,
			country: countryData.countryCode.toLowerCase(),
			yearOfBirth: userData.yearOfBirth || null,
			householdProfile: userData.householdProfile || null,
			gender: userData.gender || null,
			creationTime: Date.now(),
		};

		console.log("Creating recommender user: ", apiUserData);

		// Create user in recommender system
		const response = (await axios({
			method: "POST",
			url: apiUrl,
			data: apiUserData,
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			timeout: 10000,
			validateStatus: (status) => status < 500,
		})) as AxiosResponse;

		if (response.status === 201) {
			return { success: true };
		}

		if (response.status === 409) {
			// User already exists (race condition)
			console.log("User was created by another process: ", userDoc.id);
			return {
				success: true,
				message: "User already exists in recommender system",
			};
		}

		if (response.status >= 400 && response.status < 500) {
			console.warn(
				`createRecommenderUser: Client error ${response.status}: ${response.statusText}`,
			);
			return {
				success: false,
				error: `Client error: ${response.status} ${response.statusText}`,
			};
		}

		return {
			success: false,
			error: `Failed to create recommender user: ${response.status} ${response.statusText}`,
		};
	} catch (error) {
		// Catch all errors to prevent blocking the main function
		if (axios.isAxiosError(error)) {
			if (error.code === "ECONNABORTED") {
				console.error("createRecommenderUser: Request timeout");
				return { success: false, error: "Request timeout" };
			}
			if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
				console.error("createRecommenderUser: Network error");
				return { success: false, error: "Network error" };
			}
			if (error.response) {
				console.error(
					`createRecommenderUser: HTTP error ${error.response.status}: ${error.response.statusText}`,
				);
				return {
					success: false,
					error: `HTTP error: ${error.response.status} ${error.response.statusText}`,
				};
			}
			console.error("createRecommenderUser: Axios error:", error.message);
			return { success: false, error: `Request failed: ${error.message}` };
		}

		// Handle any other unexpected errors
		console.error("createRecommenderUser: Unexpected error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
};

const checkIfUserExists = async (
	apiUrl: string,
	apiToken: string,
): Promise<{ exists: boolean; error?: string }> => {
	try {
		const response = (await axios({
			method: "GET",
			url: apiUrl,
			headers: {
				Authorization: `Bearer ${apiToken}`,
			},
			timeout: 10000,
			validateStatus: (status) => status < 500, // Don't throw on 4xx errors
		})) as AxiosResponse;

		console.log(response.status, response.statusText);

		if (response.status === 200) {
			return { exists: true };
		}

		if (response.status === 404) {
			return { exists: false };
		}

		console.warn(
			`checkIfUserExists: Unexpected response status: ${response.status}`,
		);
		return {
			exists: false,
			error: `Unexpected response status: ${response.status}`,
		};
	} catch (error) {
		if (axios.isAxiosError(error)) {
			if (error.code === "ECONNABORTED") {
				return { exists: false, error: "Request timeout" };
			}
			if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
				return { exists: false, error: "Network error" };
			}
			if (error.response) {
				return {
					exists: false,
					error: `HTTP error: ${error.response.status} ${error.response.statusText}`,
				};
			}
			return { exists: false, error: `Request failed: ${error.message}` };
		}

		return {
			exists: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
};
