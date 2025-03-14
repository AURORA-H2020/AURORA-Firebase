import axios, { type AxiosResponse } from "axios";
import type { PvPlant } from "../models/pv-plants/pv-plant";
import { FirebaseConstants } from "../utils/firebase-constants";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

interface QpvApiResponse {
	data: {
		date: string;
		Ep: number | null;
	}[];
}

export const savePvApiData = async ({
	plantDoc,
	startDate,
	endDate,
	secrets,
}: {
	plantDoc: FirebaseFirestore.QueryDocumentSnapshot<PvPlant>;
	startDate: Date;
	endDate: Date;
	secrets: { pvApiToken: string; pvApiBaseUrl: string };
}) => {
	const apiToken = secrets.pvApiToken;
	const apiUrl = `${secrets.pvApiBaseUrl}/v1/plants/${plantDoc.data().plantId}/get-kpi-1d`;

	try {
		const response = (await axios({
			method: "get",
			url: apiUrl,
			params: {
				device: "GL",
				ini_date: dateToKebabCase(startDate),
				end_date: dateToKebabCase(endDate),
				vars: "Ep",
				page: 1,
			},
			headers: {
				Authorization: `Bearer ${apiToken}`,
			},
		})) as AxiosResponse<QpvApiResponse>;

		response.data.data.map((entry) => {
			plantDoc.ref
				.collection(FirebaseConstants.collections.pvPlants.data.name)
				.doc(entry.date)
				.set({
					...entry,
					Ep: entry.Ep === null ? 0 : entry.Ep,
					date: new Date(entry.date),
				});
		});
	} catch (error) {
		return { success: false, error };
	}

	return { success: true };
};

const dateToKebabCase = (date: Date): string => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
};
