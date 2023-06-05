import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { RecurringConsumption } from "../models/recurring-consumption/recurring-consumption";
import { Consumption } from "../models/consumption/consumption";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { FirebaseConstants } from "../utils/firebase-constants";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

/**
 * The default time zone.
 */
const defaultTimeZone = "Europe/Berlin";

/**
 * [processRecurringConsumptions]
 * A Cloud Function which is triggered by a pub/sub every day at 00:05 to process all recurring consumptions of all users.
 * The function checks if the frequency of each recurring consumption is fulfilled
 * and creates a corresponding consumption to the collection of the user.
 */
export const processRecurringConsumptions = onSchedule(
  { schedule: "every day 00:05", timeZone: defaultTimeZone },
  async () => {
    const recurringConsumptions = await getFirestore()
      .collectionGroup(FirebaseConstants.collections.users.recurringConsumptions.name)
      .get();
    await Promise.allSettled(
      recurringConsumptions.docs
        .map((recurringConsumptionDocument) => {
          // Initialize recurring consumption
          const recurringConsumption = recurringConsumptionDocument.data() as RecurringConsumption;
          // Check if frequency does not match
          if (!frequencyMatches(recurringConsumption)) {
            // Return null as recurring consumption should not be created
            // as the frequency does not match
            return null;
          }
          // Make consumption from recurring consumption
          const consumption = makeConsumption(recurringConsumption);
          // Check if consumption is unavailable
          if (!consumption) {
            // Return null as no consumption can be created
            // from the recurring consumption
            return null;
          }
          // Set generated by recurring consumption document identifier
          consumption.generatedByRecurringConsumptionId = recurringConsumptionDocument.id;
          // Retrieve the recurring consumptions collection reference
          const recurringConsumptionsCollection = recurringConsumptionDocument.ref.parent;
          // Retrieve the user document reference from the recurring consumptions collection
          const userDocument = recurringConsumptionsCollection.parent;
          // Add the consumption to the consumptions collection
          return userDocument?.collection(FirebaseConstants.collections.users.consumptions.name).add(consumption);
        })
        .filter(Boolean)
    );
  }
);

/**
 * Retrieve the current date in a given time zone.
 * @param time The optional time information.
 * @param timeZone The time zone. Default value `Europe/Berlin`
 */
function getCurrentDate(time?: { hours: number; minutes: number }, timeZone = defaultTimeZone): Date {
  const currentDate = new Date(new Date().toLocaleString("en-US", { timeZone: timeZone }));
  if (time) {
    currentDate.setUTCHours(time.hours, time.minutes, 0, 0);
  }
  return currentDate;
}

/**
 * Retrieve a bool value if the frequency of recurring consumption matches with the current date.
 * @param recurringConsumption The recurring consumption.
 * @param currentDate The current date.
 */
function frequencyMatches(recurringConsumption: RecurringConsumption, currentDate = getCurrentDate()) {
  // Switch on unit of frequency
  switch (recurringConsumption.frequency.unit) {
    case "daily":
      // Frequency matches
      return true;
    case "weekly":
      // Retrieve the day of the week
      let weekday = currentDate.getDay();
      // Check if the weekday is equal to zero (Sunday)
      if (weekday === 0) {
        // Set week day to 7 instead of 0
        weekday = 7;
      }
      // Check if week day does not match with the value of the frequency
      if (weekday !== recurringConsumption.frequency.value) {
        // Frequency does not match
        return false;
      }
      // Frequency matches
      return true;
    case "monthly":
      // TODO: Add fallback for February where recurring consumption is either 29 or 30
      // Check if day of month does not match the value of the frequency
      if (currentDate.getDate() !== recurringConsumption.frequency.value) {
        // Frequency does not match
        return false;
      }
      // Frequency matches
      return true;
  }
}

/**
 * Make a consumption from a recurring consumption, if available.
 * @param recurringConsumption The recurring consumption.
 */
function makeConsumption(recurringConsumption: RecurringConsumption): Consumption | null {
  // Switch on consumption category
  switch (recurringConsumption.category) {
    case "electricity":
      // Electricity is currently not supported
      return null;
    case "heating":
      // Heating is currently not supported
      return null;
    case "transportation":
      const transportation = recurringConsumption.transportation;
      if (!transportation) {
        return null;
      }
      return {
        createdAt: Timestamp.now(),
        category: "transportation",
        transportation: {
          dateOfTravel: Timestamp.fromDate(
            getCurrentDate({ hours: transportation.hourOfTravel, minutes: transportation.minuteOfTravel })
          ),
          transportationType: transportation.transportationType,
        },
        value: transportation.distance,
      };
  }
}