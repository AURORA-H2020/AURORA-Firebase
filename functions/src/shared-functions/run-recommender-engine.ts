import axios, { type AxiosResponse } from "axios";

export const runRecommenderEngine = async ({
	secrets,
}: {
	secrets: { recommenderApiToken: string; recommenderApiBaseUrl: string };
}) => {
	const apiToken = secrets.recommenderApiToken;
	const apiUrl = `${secrets.recommenderApiBaseUrl}/api/engine/run`;

	const response = (await axios({
		method: "get",
		url: apiUrl,
		headers: {
			Authorization: `Bearer ${apiToken}`,
		},
	})) as AxiosResponse;

	if (response.status !== 200) {
		return {
			success: false,
			error: `Failed to run recommender engine: ${response.status} ${response.statusText}`,
		};
	}
	return {
		success: true,
	};
};
