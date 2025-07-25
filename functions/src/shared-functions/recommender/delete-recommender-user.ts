import { type AxiosResponse, default as axios } from "axios";
import { initializeAppIfNeeded } from "../../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

export const deleteRecommenderUser = async ({
	userId,
	secrets,
}: {
	userId: string;
	secrets: { recommenderApiToken: string; recommenderApiBaseUrl: string };
}) => {
	try {
		// Validate required parameters
		if (!userId) {
			console.warn("deleteRecommenderUser: Invalid user ID provided");
			return { success: false, error: "Invalid user ID" };
		}

		if (!secrets?.recommenderApiToken || !secrets?.recommenderApiBaseUrl) {
			console.warn("deleteRecommenderUser: Missing required secrets");
			return { success: false, error: "Missing required secrets" };
		}

		const apiToken = secrets.recommenderApiToken;
		const apiUrl = `${secrets.recommenderApiBaseUrl}/api/user/${userId}`;

		console.log("Deleting recommender user: ", userId);

		// Delete user from recommender system
		const response = (await axios({
			method: "DELETE",
			url: apiUrl,
			headers: {
				Authorization: `Bearer ${apiToken}`,
			},
			timeout: 10000,
			validateStatus: (status) => status < 500,
		})) as AxiosResponse;

		if (response.status === 200 || response.status === 204) {
			console.log("Successfully deleted recommender user: ", userId);
			return { success: true };
		}

		if (response.status === 404) {
			// User doesn't exist - consider this a success since the end result is the same
			console.log("User not found in recommender system: ", userId);
			return {
				success: true,
				message: "User not found in recommender system",
			};
		}

		if (response.status >= 400 && response.status < 500) {
			console.warn(
				`deleteRecommenderUser: Client error ${response.status}: ${response.statusText}`,
			);
			return {
				success: false,
				error: `Client error: ${response.status} ${response.statusText}`,
			};
		}

		return {
			success: false,
			error: `Failed to delete recommender user: ${response.status} ${response.statusText}`,
		};
	} catch (error) {
		// Catch all errors to prevent blocking the main function
		if (axios.isAxiosError(error)) {
			if (error.code === "ECONNABORTED") {
				console.error("deleteRecommenderUser: Request timeout");
				return { success: false, error: "Request timeout" };
			}
			if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
				console.error("deleteRecommenderUser: Network error");
				return { success: false, error: "Network error" };
			}
			if (error.response) {
				console.error(
					`deleteRecommenderUser: HTTP error ${error.response.status}: ${error.response.statusText}`,
				);
				return {
					success: false,
					error: `HTTP error: ${error.response.status} ${error.response.statusText}`,
				};
			}
			console.error("deleteRecommenderUser: Axios error:", error.message);
			return { success: false, error: `Request failed: ${error.message}` };
		}

		// Handle any other unexpected errors
		console.error("deleteRecommenderUser: Unexpected error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
};
