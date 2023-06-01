import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { PreferredCloudFunctionRegion } from "../utils/preferred-cloud-function-region";
import { initializeAppIfNeeded } from "../utils/initialize-app-if-needed";
import { RecurringConsumption } from "../models/recurring-consumption/recurring-consumption";
import { Consumption } from "../models/consumption/consumption";
import { Timestamp } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
initializeAppIfNeeded();

/**
 * [processRecurringConsumptions]
 * A Cloud Function which is triggered by a pub/sub every day at 00:05 to process all recurring consumptions of all users.
 * The function checks if the frequency of each recurring consumption is fulfilled
 * and creates a corresponding consumption to the collection of the user.
 */
export const processRecurringConsumptions = functions
  .region(PreferredCloudFunctionRegion)
  .pubsub.schedule("every day 00:05")
  .onRun(async () => {
    const recurringConsumptions = await admin.firestore().collectionGroup("recurring-consumptions").get();
    await Promise.allSettled(
      recurringConsumptions.docs
        .map((doc) => {
          // Initialize recurring consumption
          const recurringConsumption = doc.data() as RecurringConsumption;
          // Switch on unit of frequency
          switch (recurringConsumption.frequency.unit) {
            case "daily":
              // Simply do nothing as consumption should be created every day
              break;
            case "weekly":
              // Retrieve the day of the week
              let weekday = new Date().getDay();
              // Check if the weekday is equal to zero (Sunday)
              if (weekday === 0) {
                // Set week day to 7 instead of 0
                weekday = 7;
              }
              // Check if week day does not match with the value of the frequency
              if (weekday !== recurringConsumption.frequency.value) {
                // Do not create consumption
                return null;
              }
              break;
            case "monthly":
              // Check if day of month does not match the value of the frequency
              if (new Date().getDate() !== recurringConsumption.frequency.value) {
                // Do not create consumption
                return null;
              }
              break;
          }
          // Declare consumption
          let consumption: Consumption;
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
              const dateOfTravel = new Date();
              dateOfTravel.setHours(transportation.hourOfTravel, transportation.minuteOfTravel, 0, 0);
              consumption = {
                createdAt: Timestamp.now(),
                category: "transportation",
                transportation: {
                  dateOfTravel: Timestamp.fromDate(dateOfTravel),
                  transportationType: transportation.transportationType,
                },
                value: transportation.distance,
              };
          }
          // Add consumption
          const recurringConsumptionsCollection = doc.ref.parent;
          const userDocument = recurringConsumptionsCollection.parent;
          return userDocument?.collection("consumptions").add(consumption);
        })
        .filter(Boolean)
    );
  });
