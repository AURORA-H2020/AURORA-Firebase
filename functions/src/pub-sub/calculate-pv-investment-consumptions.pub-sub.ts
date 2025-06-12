import {
	type DocumentData,
	getFirestore,
	type QueryDocumentSnapshot,
	Timestamp,
} from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import type { Consumption } from "../models/consumption/consumption";
import type { PvPlantData } from "../models/pv-plants/data/pv-plant-data";
import type { PvPlant } from "../models/pv-plants/pv-plant";
import type { UserPvInvestment } from "../models/user/user-pv-investment/user-pv-investment";
import { FirebaseConstants } from "../utils/firebase-constants";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

/**
 * [calculatePvInvestmentConsumptions]
 * A Scheduled Cloud Function which is triggered by a pub/sub every friday at 00:30.
 * This functions checks all PV investments and calculates a corresponding consumption for each.
 * Each individual investment has one consumption attributed, which is updated once a week.
 */
export const calculatePvInvestmentConsumptions = onSchedule(
	{ schedule: "every friday 00:30", timeZone: "Europe/Berlin" },
	async () => {
		const pvPlants = await firestore
			.collectionGroup(FirebaseConstants.collections.pvPlants.name)
			.where("active", "==", true)
			.get();

		const pvInvestments = await firestore
			.collectionGroup(FirebaseConstants.collections.users.pvInvestments.name)
			.get();

		await Promise.allSettled(
			pvPlants.docs
				.map(async (pvPlantDocument) => {
					const pvPlant = pvPlantDocument.data() as PvPlant;

					const pvData = await firestore
						.collection(FirebaseConstants.collections.pvPlants.name)
						.doc(pvPlantDocument.id)
						.collection(FirebaseConstants.collections.pvPlants.data.name)
						.get();

					await Promise.allSettled(
						pvInvestments.docs
							.map(async (pvInvestmentDocument) => {
								const pvInvestment =
									pvInvestmentDocument.data() as UserPvInvestment;

								/**
								 * Check if the investment is for the correct PV plant
								 * Seems inefficient, but getting the pvInvestment collectionGroup here doesn't seem to work.
								 */
								if (pvInvestment.pvPlant !== pvPlantDocument.id) return null;

								const applicablePvData = pvData.docs.filter((d) => {
									const pvData = d.data() as PvPlantData;
									return pvData.date >= pvInvestment.investmentDate;
								});

								const consumption = makeConsumption(
									pvPlant,
									pvInvestment,
									sumPvData(applicablePvData),
								);
								if (!consumption) {
									// Return null as no consumption can be created
									return null;
								}

								consumption.generatedByPvInvestmentId = pvInvestmentDocument.id;

								// Retrieve the pv-investments collection reference
								const pvInvestmentsCollection = pvInvestmentDocument.ref.parent;
								// Retrieve the user document reference from the pv-investments collection
								const userDocument = pvInvestmentsCollection.parent;
								if (!userDocument) return null;
								// Add the consumption to the consumptions collection
								const documentRef = userDocument
									.collection(
										FirebaseConstants.collections.users.consumptions.name,
									)
									.doc(pvInvestmentDocument.id);
								return documentRef.set(consumption);
							})
							.filter(Boolean),
					);
				})
				.filter(Boolean),
		);
	},
);

/**
 * Calculates the total amount of electricity produced (Ep) for a given list of pv data documents.
 *
 * @param {QueryDocumentSnapshot<DocumentData>[]} pvDataDocuments the list of pv data documents
 * @returns {number} total Ep
 */
const sumPvData = (pvDataDocuments: QueryDocumentSnapshot<DocumentData>[]) => {
	return pvDataDocuments
		.map((p) => {
			return p.data() as PvPlantData;
		})
		.reduce((prev, d) => prev + d.Ep, 0);
};

/**
 * Create a consumption record from a photovoltaic (PV) investment.
 *
 * Calculates the electricity consumption based on the user's share in the PV plant capacity and the total electricity
 * produced (Ep). If the PV plant does not have a defined capacity or no electricity is produced, returns null.
 *
 * @param pvPlant The photovoltaic plant data.
 * @param pvInvestment The user's investment data in the PV plant.
 * @param Ep The total electricity produced by the PV plant.
 * @returns A consumption record of type `Consumption` if valid, otherwise null.
 */
function makeConsumption(
	pvPlant: PvPlant,
	pvInvestment: UserPvInvestment,
	Ep: number,
): Consumption | null {
	if (!pvPlant.capacity || !Ep || !pvInvestment.investmentCapacity) {
		return null;
	}

	const sharePercentage = pvInvestment.investmentCapacity / pvPlant.capacity;

	return {
		createdAt: Timestamp.now(),
		category: "electricity",
		electricity: {
			startDate: pvInvestment.investmentDate,
			endDate: Timestamp.now(),
			householdSize: 1,
			electricitySource: "pvInvestment",
		},
		value: Ep * sharePercentage,
		description: `${pvPlant.name} | ${pvPlant.capacity} kW | ${pvInvestment.investmentCapacity}%`,
	};
}
