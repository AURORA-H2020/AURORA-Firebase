import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { RecurringConsumption } from "../models/recurring-consumption/recurring-consumption";
import { Consumption } from "../models/consumption/consumption";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { FirebaseConstants } from "../utils/firebase-constants";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

// Initialize Firestore
const firestore = getFirestore();

/**
 * [processRecurringConsumptions]
 * A Cloud Function which is triggered by a pub/sub every day at 00:05 to process all recurring consumptions of all users.
 * The function checks if the frequency of each recurring consumption is fulfilled
 * and creates a corresponding consumption to the collection of the user.
 */
export const processRecurringConsumptions = onSchedule(
  { schedule: "every day 00:05", timeZone: "Europe/Berlin" },
  async () => {
    // Retrieve all enabled recurring consumptions
    const recurringConsumptions = await firestore
      .collectionGroup(FirebaseConstants.collections.users.recurringConsumptions.name)
      .where("isEnabled", "==", true)
      .get();
    // Wait until all recurring consumptions have been processed
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
 * @param timeZone The time zone. Default value `UTC`
 */
function getCurrentDate(time?: { hours: number; minutes: number }, timeZone = "UTC"): Date {
  const date = new Date();
  if (time) {
    date.setUTCHours(time.hours, time.minutes, 0, 0);
  }
  return new Date(date.toLocaleString("en-US", { timeZone: timeZone, hour12: false }));
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
      // Frequency always matches
      return true;
    case "weekly":
      // Retrieve the day of the week
      let weekday = currentDate.getDay();
      // Check if the weekday is equal to zero (Sunday)
      if (weekday === 0) {
        // Set week day to 7 instead of 0
        weekday = 7;
      }
      // Return bool if weekday is included
      return recurringConsumption.frequency.weekdays?.includes(weekday) === true;
    case "monthly":
      // Initialize the day of the month provided by the frequency
      const frequencyDayOfMonth = recurringConsumption.frequency.dayOfMonth;
      // Check if day of month is unavailable
      if (!frequencyDayOfMonth) {
        // Frequency does not match
        return false;
      }
      // Initialize the current day of month
      const currentDayOfMonth = currentDate.getDate();
      // Check if current day of month matches with the frequency day of month
      if (currentDayOfMonth === frequencyDayOfMonth) {
        // Frequency matches
        return true;
      }
      // Otherwise perform fallback if the frequency specifies a day of month
      // which is higher than the available number of days for the current month.
      else {
        // Initialize a copy of the current date
        const currentDateCopy = new Date(currentDate);
        // Set the utc date to zero which will return the
        // number of days in the month when calling `getDate`
        currentDateCopy.setUTCDate(0);
        // Retrieve the number of days in month
        const numberOfDaysInMonth = currentDateCopy.getDate();
        // Frequency matches if the current day of month matches with the total number of days
        // and the day of the month specified in the frequency is greater than the total number of days
        return currentDayOfMonth === numberOfDaysInMonth && frequencyDayOfMonth > numberOfDaysInMonth;
      }
    default:
      return false;
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
          privateVehicleOccupancy: transportation.privateVehicleOccupancy,
          publicVehicleOccupancy: transportation.publicVehicleOccupancy,
        },
        value: transportation.distance,
        description: recurringConsumption.description,
      };
  }
}
