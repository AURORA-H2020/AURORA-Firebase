/**
 * The Firestore Collections
 */
export const FirestoreCollections = {
  countries: {
    name: "countries",
    cities: {
      name: "cities",
      path: (countryId: string) =>
        [FirestoreCollections.countries.name, countryId, FirestoreCollections.countries.cities.name].join("/"),
    },
    metrics: {
      name: "metrics",
      path: (countryId: string) =>
        [FirestoreCollections.countries.name, countryId, FirestoreCollections.countries.metrics.name].join("/"),
    },
  },
  users: {
    name: "users",
    consumptions: {
      name: "consumptions",
      path: (userId: string) =>
        [FirestoreCollections.users.name, userId, FirestoreCollections.users.consumptions.name].join("/"),
    },
    consumptionSummaries: {
      name: "consumption-summaries",
      path: (userId: string) =>
        [FirestoreCollections.users.name, userId, FirestoreCollections.users.consumptions.name].join("/"),
    },
  },
};
