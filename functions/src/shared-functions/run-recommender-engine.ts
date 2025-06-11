import axios, { type AxiosResponse } from "axios";

export const runRecommenderEngine = async ({
	secrets,
}: {
	secrets: { recommenderApiToken: string; recommenderApiBaseUrl: string };
}) => {
	try {
		// Validate required parameters
		if (!secrets?.recommenderApiToken || !secrets?.recommenderApiBaseUrl) {
			console.warn("runRecommenderEngine: Missing required secrets");
			return { success: false, error: "Missing required secrets" };
		}

		const apiToken = secrets.recommenderApiToken;
		const apiUrl = `${secrets.recommenderApiBaseUrl}/api/engine/run`;

		console.log("runRecommenderEngine: Starting engine run...");

		const response = (await axios({
			method: "GET",
			url: apiUrl,
			headers: {
				Authorization: `Bearer ${apiToken}`,
			},
			timeout: 60000, // 60 second timeout - engine runs might take longer
			validateStatus: (status) => status < 500, // Don't throw on 4xx errors
			maxRedirects: 5,
		})) as AxiosResponse;

		if (response.status === 200) {
			console.log("runRecommenderEngine: Engine run completed successfully");
			return { success: true };
		}

		// Handle different HTTP status codes
		if (response.status >= 400 && response.status < 500) {
			console.warn(
				`runRecommenderEngine: Client error ${response.status}: ${response.statusText}`,
			);
			return {
				success: false,
				error: `Client error: ${response.status} ${response.statusText}`,
			};
		}

		if (response.status >= 500) {
			console.error(
				`runRecommenderEngine: Server error ${response.status}: ${response.statusText}`,
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
			// Handle connection reset specifically
			if (error.code === "ECONNRESET") {
				console.error("runRecommenderEngine: Connection reset by server");
				return { success: false, error: "Connection reset by server" };
			}
			if (error.code === "ECONNABORTED") {
				console.error("runRecommenderEngine: Request timeout");
				return { success: false, error: "Request timeout" };
			}
			if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
				console.error("runRecommenderEngine: Network error");
				return { success: false, error: "Network error" };
			}
			// Handle socket hang up
			if (error.message.includes("socket hang up")) {
				console.error("runRecommenderEngine: Socket hang up");
				return { success: false, error: "Socket hang up" };
			}
			if (error.response) {
				console.error(
					`runRecommenderEngine: HTTP error ${error.response.status}: ${error.response.statusText}`,
				);
				return {
					success: false,
					error: `HTTP error: ${error.response.status} ${error.response.statusText}`,
				};
			}
			console.error("runRecommenderEngine: Axios error:", error.message);
			return { success: false, error: `Request failed: ${error.message}` };
		}

		// Handle any other unexpected errors
		console.error("runRecommenderEngine: Unexpected error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
};
