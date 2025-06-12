import axios, { type AxiosResponse } from "axios";
import type { Consumption } from "../../models/consumption/consumption";
import { initializeAppIfNeeded } from "../../utils/initialize-app-if-needed";
import { createRecommenderUserIfNeeded } from "./create-recommender-user-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

export const createRecommenderConsumptions = async ({
	userId,
	consumptionDocs,
	secrets,
}: {
	userId: string;
	consumptionDocs:
		| FirebaseFirestore.QueryDocumentSnapshot<Consumption>[]
		| FirebaseFirestore.QueryDocumentSnapshot<Consumption>;
	secrets: { recommenderApiToken: string; recommenderApiBaseUrl: string };
}) => {
	try {
		// Validate required parameters
		if (!userId) {
			console.warn("createRecommenderConsumptions: Invalid userId provided");
			return { success: false, error: "Invalid userId" };
		}

		if (!consumptionDocs) {
			console.warn(
				"createRecommenderConsumptions: No consumption documents provided",
			);
			return { success: false, error: "No consumption documents provided" };
		}

		if (!secrets?.recommenderApiToken || !secrets?.recommenderApiBaseUrl) {
			console.warn("createRecommenderConsumptions: Missing required secrets");
			return { success: false, error: "Missing required secrets" };
		}

		// Ensure user exists in recommender system first - MUST succeed
		console.log("Ensuring user exists in recommender system:", userId);
		const userCreationResult = await createRecommenderUserIfNeeded({
			userId,
			secrets,
		});

		if (!userCreationResult.success) {
			console.error(
				"createRecommenderConsumptions: Failed to ensure user exists:",
				userCreationResult.error,
			);
			return {
				success: false,
				error: `User creation failed: ${userCreationResult.error}`,
			};
		}

		console.log(
			"createRecommenderConsumptions: User ready in recommender system",
		);

		const apiToken = secrets.recommenderApiToken;
		const apiUrl = `${secrets.recommenderApiBaseUrl}/api/user/${userId}/auroraconsumptions`;

		// Handle both single document and array of documents
		const docsArray = Array.isArray(consumptionDocs)
			? consumptionDocs
			: [consumptionDocs];

		// Filter out null/undefined documents and validate document structure
		const validDocs = docsArray.filter((doc) => {
			if (!doc) {
				console.warn(
					"createRecommenderConsumptions: Null/undefined document found",
				);
				return false;
			}
			if (!doc.id) {
				console.warn("createRecommenderConsumptions: Document missing id");
				return false;
			}
			if (typeof doc.data !== "function") {
				console.warn(
					"createRecommenderConsumptions: Document missing data function",
				);
				return false;
			}
			return true;
		});

		if (validDocs.length === 0) {
			console.warn(
				"createRecommenderConsumptions: No valid documents to process",
			);
			return { success: false, error: "No valid documents to process" };
		}

		// Safely extract data from documents
		const data = validDocs.map((doc) => {
			try {
				const docData = doc.data();
				return {
					id: doc.id,
					...docData,
				};
			} catch (error) {
				console.warn(
					`createRecommenderConsumptions: Error extracting data from document ${doc.id}:`,
					error,
				);
				// Return minimal data structure if extraction fails
				return {
					id: doc.id,
				};
			}
		});

		console.log("Adding recommender consumptions: ", data.length);

		// Set reasonable timeout and retry logic
		const response = (await axios({
			method: "POST",
			url: apiUrl,
			data,
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			timeout: 10000,
			validateStatus: (status) => status < 500, // Don't throw on 4xx errors
		})) as AxiosResponse;

		if (response.status === 201) {
			return { success: true };
		}

		// Handle different HTTP status codes
		if (response.status >= 400 && response.status < 500) {
			console.warn(
				`createRecommenderConsumptions: Client error ${response.status}: ${response.statusText}`,
			);
			return {
				success: false,
				error: `Client error: ${response.status} ${response.statusText}`,
			};
		}

		if (response.status >= 500) {
			console.error(
				`createRecommenderConsumptions: Server error ${response.status}: ${response.statusText}`,
			);
			return {
				success: false,
				error: `Server error: ${response.status} ${response.statusText}`,
			};
		}

		return {
			success: false,
			error: `Unexpected response status: ${response.status} ${response.statusText}`,
		};
	} catch (error) {
		// Catch all errors to prevent blocking the main function
		if (axios.isAxiosError(error)) {
			if (error.code === "ECONNABORTED") {
				console.error("createRecommenderConsumptions: Request timeout");
				return { success: false, error: "Request timeout" };
			}
			if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
				console.error("createRecommenderConsumptions: Network error");
				return { success: false, error: "Network error" };
			}
			if (error.response) {
				console.error(
					`createRecommenderConsumptions: HTTP error ${error.response.status}: ${error.response.statusText}`,
				);
				return {
					success: false,
					error: `HTTP error: ${error.response.status} ${error.response.statusText}`,
				};
			}
			console.error(
				"createRecommenderConsumptions: Axios error:",
				error.message,
			);
			return { success: false, error: `Request failed: ${error.message}` };
		}

		// Handle any other unexpected errors
		console.error("createRecommenderConsumptions: Unexpected error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
};
