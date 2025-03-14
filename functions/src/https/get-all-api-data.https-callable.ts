import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { PvPlant } from "../models/pv-plants/pv-plant";
import { isAdmin } from "../shared-functions/is-Admin";
import { savePvApiData } from "../shared-functions/save-pv-api-data";
import { FirebaseConstants } from "../utils/firebase-constants";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

// Get API token and URL from Secret Manager
const pvApiToken = defineSecret("PV_API_TOKEN");
const pvApiBaseUrl = defineSecret("PV_API_BASE_URL");

/**
 * [getAllApiData]
 * A HTTPS Callable Cloud Function.
 * This functions fetches all PV data from an API and stores it in Firestore.
 * Triggered manually for fixing missing data or initalising new PV plants.
 */
export const getAllApiData = onCall(
	{ secrets: [pvApiToken, pvApiBaseUrl] },
	async (req) => {
		const { plantDocumentId } = req.data;

		const auth = req.auth;
		// Check if auth is not available

		if (!auth || !(await isAdmin(auth.uid))) {
			// Throw failed precondition error
			throw new HttpsError(
				"failed-precondition",
				"The function must be called while authenticated",
			);
		}

		if (!plantDocumentId) {
			return { success: false, error: "Missing plantDocumentId" };
		}

		const plantDoc = (await firestore
			.collection(FirebaseConstants.collections.pvPlants.name)
			.doc(plantDocumentId)
			.get()) as FirebaseFirestore.QueryDocumentSnapshot<PvPlant>;

		if (!plantDoc.exists) {
			return { success: false, error: "Plant not found" };
		}

		if (!plantDoc.data().active) {
			return { success: false, error: "Plant not active" };
		}

		if (!plantDoc.data().installationDate) {
			return { success: false, error: "Plant has no installation date" };
		}

		/**
		 * Use yesterday's date for the API call.
		 * This is because the data for the current day may not be available yet.
		 */
		const getYesterday = () => {
			const today = new Date();
			const yesterday = new Date();
			yesterday.setDate(today.getDate() - 1);
			return yesterday;
		};

		const result = await savePvApiData({
			plantDoc: plantDoc,
			startDate: plantDoc.data().installationDate?.toDate() ?? getYesterday(), // Making typescript happy..
			endDate: getYesterday(),
			secrets: {
				pvApiToken: pvApiToken.value(),
				pvApiBaseUrl: pvApiBaseUrl.value(),
			},
		});

		return { ...result };
	},
);
