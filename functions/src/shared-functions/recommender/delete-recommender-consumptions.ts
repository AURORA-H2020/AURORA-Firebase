import axios from "axios";
import { initializeAppIfNeeded } from "../../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

export const deleteRecommenderConsumptions = async ({
	userId,
	consumptionIds,
	secrets,
}: {
	userId: string;
	consumptionIds: string[] | string;
	secrets: { recommenderApiToken: string; recommenderApiBaseUrl: string };
}) => {
	try {
		// Validate required parameters
		if (!userId || typeof userId !== "string") {
			console.warn("deleteRecommenderConsumptions: Invalid userId provided");
			return { success: false, error: "Invalid userId" };
		}

		if (!consumptionIds) {
			console.warn(
				"deleteRecommenderConsumptions: No consumption IDs provided",
			);
			return { success: false, error: "No consumption IDs provided" };
		}

		if (!secrets?.recommenderApiToken || !secrets?.recommenderApiBaseUrl) {
			console.warn("deleteRecommenderConsumptions: Missing required secrets");
			return { success: false, error: "Missing required secrets" };
		}

		const apiToken = secrets.recommenderApiToken;

		// Handle both single ID and array of IDs
		const idsArray = Array.isArray(consumptionIds)
			? consumptionIds
			: [consumptionIds];

		// Filter out invalid IDs
		const validIds = idsArray.filter((id) => {
			if (!id || typeof id !== "string") {
				console.warn(
					"deleteRecommenderConsumptions: Invalid consumption ID found:",
					id,
				);
				return false;
			}
			return true;
		});

		if (validIds.length === 0) {
			console.warn(
				"deleteRecommenderConsumptions: No valid consumption IDs to process",
			);
			return { success: false, error: "No valid consumption IDs to process" };
		}

		console.log("Deleting recommender consumptions: ", validIds.length);

		// Process deletions (you can do batch or individual based on your API)
		const results = await Promise.allSettled(
			validIds.map(async (consumptionId) => {
				const apiUrl = `${secrets.recommenderApiBaseUrl}/api/user/${userId}/auroraconsumptions/${consumptionId}`;

				return axios({
					method: "DELETE",
					url: apiUrl,
					headers: {
						Authorization: `Bearer ${apiToken}`,
					},
					timeout: 10000,
					validateStatus: (status) => status < 500,
				});
			}),
		);

		// Analyze results
		const successful = results.filter(
			(result) =>
				result.status === "fulfilled" &&
				(result.value.status === 200 ||
					result.value.status === 204 ||
					result.value.status === 404),
		).length;

		const failed = results.length - successful;

		if (failed > 0) {
			console.warn(
				`deleteRecommenderConsumptions: ${failed} deletions failed out of ${results.length}`,
			);
		}

		return {
			success: successful > 0,
			deleted: successful,
			failed: failed,
			total: results.length,
		};
	} catch (error) {
		// Catch all errors to prevent blocking the main function
		if (axios.isAxiosError(error)) {
			if (error.code === "ECONNABORTED") {
				console.error("deleteRecommenderConsumptions: Request timeout");
				return { success: false, error: "Request timeout" };
			}
			if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
				console.error("deleteRecommenderConsumptions: Network error");
				return { success: false, error: "Network error" };
			}
			if (error.response) {
				console.error(
					`deleteRecommenderConsumptions: HTTP error ${error.response.status}: ${error.response.statusText}`,
				);
				return {
					success: false,
					error: `HTTP error: ${error.response.status} ${error.response.statusText}`,
				};
			}
			console.error(
				"deleteRecommenderConsumptions: Axios error:",
				error.message,
			);
			return { success: false, error: `Request failed: ${error.message}` };
		}

		// Handle any other unexpected errors
		console.error("deleteRecommenderConsumptions: Unexpected error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
};
