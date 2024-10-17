import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { PvPlant } from "../models/pv-plants/pv-plant";
import { savePvApiData } from "../shared-functions/save-pv-api-data";
import { FirebaseConstants } from "../utils/firebase-constants";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

/**
 * [getDailyApiData]
 * A Cloud Function which is triggered by a pub/sub every day at 23:30 to get the daily API data for all active PV plants.
 * The function checks for active plants and adds yesterday's data to the 'data' collection of each plant via 'savePvApiData'.
 */
export const getDailyApiData = onSchedule({ schedule: "every day 23:30", timeZone: "Europe/Berlin" }, async () => {
  const resultStatus: { success: boolean; error?: unknown; plantId: string }[] = [];

  const activePlants = (await firestore
    .collectionGroup(FirebaseConstants.collections.pvPlants.name)
    .where("active", "==", true)
    .get()) as FirebaseFirestore.QuerySnapshot<PvPlant>;

  const promises = activePlants.docs.map(async (plantDoc) => {
    if (plantDoc.data().plantId === null) {
      return;
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

    const res = await savePvApiData({
      plantDoc: plantDoc,
      startDate: getYesterday(),
      endDate: getYesterday(),
    });

    resultStatus.push({ ...res, plantId: plantDoc.data().plantId });
  });

  Promise.all(promises).then(() => console.log(resultStatus));
});
