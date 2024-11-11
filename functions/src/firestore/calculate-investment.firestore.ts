import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { PvPlant } from "../models/pv-plants/pv-plant";
import { UserPvInvestment } from "../models/user/user-pv-investment/user-pv-investment";
import { FirebaseConstants } from "../utils/firebase-constants";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

/**
 * [calculateCarbonEmissionsV2]
 * A Cloud Function triggered by a document write in the consumptions sub-collection of a user.
 * This function will calculate the carbon emissions and write it to the corresponding property.
 */
export const calculateInvestment = onDocumentWritten(
  `${FirebaseConstants.collections.users.name}/{userId}/${FirebaseConstants.collections.users.pvInvestments.name}/{investmentId}`,
  async (event) => {
    if (!event.data) {
      return null;
    }
    const beforeData = event.data.before.data() as UserPvInvestment | undefined;
    const afterData = event.data.after.data() as UserPvInvestment | undefined;

    // Check if any field has changed
    if (beforeData && afterData) {
      if (JSON.stringify(beforeData) === JSON.stringify(afterData)) {
        return null;
      }
    }

    // Update the document with the results of the calculations
    if (afterData) {
      // Get the assosciated PV plant document
      const plantDoc = await firestore
        .collection(FirebaseConstants.collections.pvPlants.name)
        .doc(afterData.pvPlant)
        .get();

      if (!plantDoc.exists) {
        console.error(`Plant document with ID ${afterData.pvPlant} does not exist.`);
        return null;
      }

      const plantData = plantDoc.data() as PvPlant;

      const investmentKwValue = afterData.share * plantData.kwPerShare;
      const investmentPriceValue = afterData.share * plantData.pricePerShare;

      await firestore
        .collection(FirebaseConstants.collections.users.name)
        .doc(event.params.userId)
        .collection(FirebaseConstants.collections.users.pvInvestments.name)
        .doc(event.params.investmentId)
        .update({
          investmentPrice: investmentPriceValue,
          investmentCapacity: investmentKwValue,
        });
    }

    return null;
  }
);
