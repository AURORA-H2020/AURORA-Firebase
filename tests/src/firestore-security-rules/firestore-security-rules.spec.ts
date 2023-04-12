import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestContext,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";

describe("Firestore Security Rules", () => {
  const authenticatedContextUserId = "MOCKED_USER_ID";
  let testEnvironment: RulesTestEnvironment;
  let authenticatedContext: RulesTestContext;
  let unauthenticatedContext: RulesTestContext;

  beforeEach(async () => {
    testEnvironment = await initializeTestEnvironment({
      projectId: "aurora-firestore-security-rules-tests",
      firestore: {
        rules: fs.readFileSync("../firestore.rules", "utf8"),
      },
    });
    authenticatedContext = testEnvironment.authenticatedContext(authenticatedContextUserId);
    unauthenticatedContext = testEnvironment.unauthenticatedContext();
  });

  afterEach(() => testEnvironment?.cleanup());

  describe("/", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single document", () =>
        assertFails(unauthenticatedContext.firestore().collection("UNKNOWN_TEST_COLLECTION").doc("1").get()));
      it("Deny to list all documents", () =>
        assertFails(unauthenticatedContext.firestore().collection("UNKNOWN_TEST_COLLECTION").get()));
      it("Deny to create a document", () =>
        assertFails(unauthenticatedContext.firestore().collection("UNKNOWN_TEST_COLLECTION").add({})));
      it("Deny to update a document", () =>
        assertFails(unauthenticatedContext.firestore().collection("UNKNOWN_TEST_COLLECTION").doc("1").update({})));
      it("Deny to delete a document", () =>
        assertFails(unauthenticatedContext.firestore().collection("UNKNOWN_TEST_COLLECTION").doc("1").delete()));
    });
    describe("Authorized User", () => {
      it("Deny to read a single document", () =>
        assertFails(authenticatedContext.firestore().collection("UNKNOWN_TEST_COLLECTION").doc("1").get()));
      it("Deny to list all documents", () =>
        assertFails(authenticatedContext.firestore().collection("UNKNOWN_TEST_COLLECTION").get()));
      it("Deny to create a document", () =>
        assertFails(authenticatedContext.firestore().collection("UNKNOWN_TEST_COLLECTION").add({})));
      it("Deny to update a document", () =>
        assertFails(authenticatedContext.firestore().collection("UNKNOWN_TEST_COLLECTION").doc("1").update({})));
      it("Deny to delete a document", () =>
        assertFails(authenticatedContext.firestore().collection("UNKNOWN_TEST_COLLECTION").doc("1").delete()));
    });
  });

  describe("/countries", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single country", () =>
        assertFails(unauthenticatedContext.firestore().collection("countries").doc("1").get()));
      it("Deny to list all countries", () =>
        assertFails(unauthenticatedContext.firestore().collection("countries").get()));
      it("Deny to create a country", () =>
        assertFails(unauthenticatedContext.firestore().collection("countries").add({})));
      it("Deny to update a country", () =>
        assertFails(unauthenticatedContext.firestore().collection("countries").doc("1").update({})));
      it("Deny to delete a country", () =>
        assertFails(unauthenticatedContext.firestore().collection("countries").doc("1").delete()));
    });
    describe("Authorized User", () => {
      it("Allow to read a single country", () =>
        assertSucceeds(authenticatedContext.firestore().collection("countries").doc("1").get()));
      it("Allow to list all countries", () =>
        assertSucceeds(authenticatedContext.firestore().collection("countries").get()));
      it("Deny to create a country", () =>
        assertFails(authenticatedContext.firestore().collection("countries").add({})));
      it("Deny to update a country", () =>
        assertFails(authenticatedContext.firestore().collection("countries").doc("1").update({})));
      it("Deny to delete a country", () =>
        assertFails(authenticatedContext.firestore().collection("countries").doc("1").delete()));
    });
  });

  describe("/countries/cities", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single city", () =>
        assertFails(
          unauthenticatedContext.firestore().collection("countries").doc("1").collection("cities").doc("1").get()
        ));
      it("Deny to list all cities", () =>
        assertFails(unauthenticatedContext.firestore().collection("countries").doc("1").collection("cities").get()));
      it("Deny to create a city", () =>
        assertFails(unauthenticatedContext.firestore().collection("countries").doc("1").collection("cities").add({})));
      it("Deny to update a city", () =>
        assertFails(
          unauthenticatedContext.firestore().collection("countries").doc("1").collection("cities").doc("1").update({})
        ));
      it("Deny to delete a city", () =>
        assertFails(
          unauthenticatedContext.firestore().collection("countries").doc("1").collection("cities").doc("1").delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single city", () =>
        assertSucceeds(
          authenticatedContext.firestore().collection("countries").doc("1").collection("cities").doc("1").get()
        ));
      it("Allow to list all cities", () =>
        assertSucceeds(authenticatedContext.firestore().collection("countries").doc("1").collection("cities").get()));
      it("Deny to create a city", () =>
        assertFails(authenticatedContext.firestore().collection("countries").doc("1").collection("cities").add({})));
      it("Deny to update a city", () =>
        assertFails(
          authenticatedContext.firestore().collection("countries").doc("1").collection("cities").doc("1").update({})
        ));
      it("Deny to delete a city", () =>
        assertFails(
          authenticatedContext.firestore().collection("countries").doc("1").collection("cities").doc("1").delete()
        ));
    });
  });

  describe("/users", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single user", () =>
        assertFails(unauthenticatedContext.firestore().collection("users").doc("1").get()));
      it("Deny to list all users", () => assertFails(unauthenticatedContext.firestore().collection("users").get()));
      it("Deny to create a user", () => assertFails(unauthenticatedContext.firestore().collection("users").add({})));
      it("Deny to update a user", () =>
        assertFails(unauthenticatedContext.firestore().collection("users").doc("1").update({})));
      it("Deny to delete a user", () =>
        assertFails(unauthenticatedContext.firestore().collection("users").doc("1").delete()));
    });
    describe("Authorized User", () => {
      it("Allow to read a single user if auth uid matches", () =>
        assertSucceeds(authenticatedContext.firestore().collection("users").doc(authenticatedContextUserId).get()));
      it("Deny to read a single user if auth uid not matches", () =>
        assertFails(authenticatedContext.firestore().collection("users").doc("1").get()));
      it("Deny to list all users", () => assertFails(authenticatedContext.firestore().collection("users").get()));
      it("Allow to create a user if auth uid matches", () =>
        assertSucceeds(authenticatedContext.firestore().collection("users").doc(authenticatedContextUserId).set({})));
      it("Deny to create a user if auth uid not matches", () =>
        assertFails(authenticatedContext.firestore().collection("users").doc("1").set({})));
      it("Allow to update a user if auth uid matches", () =>
        assertSucceeds(
          authenticatedContext.firestore().collection("users").doc(authenticatedContextUserId).update({})
        ));
      it("Deny to update a user if auth uid not matches", () =>
        assertFails(authenticatedContext.firestore().collection("users").doc("1").update({})));
      it("Deny to delete a user", () =>
        assertFails(authenticatedContext.firestore().collection("users").doc("1").delete()));
    });
  });

  describe("/users/consumptions", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single consumption", () =>
        assertFails(
          unauthenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .doc("1")
            .get()
        ));
      it("Deny to list all consumptions", () =>
        assertFails(
          unauthenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .get()
        ));
      it("Deny to create a consumption", () =>
        assertFails(
          unauthenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .add({})
        ));
      it("Deny to update a consumption", () =>
        assertFails(
          unauthenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .doc("1")
            .update({})
        ));
      it("Deny to delete a consumption", () =>
        assertFails(
          unauthenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .doc("1")
            .delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single consumption if auth uid matches", () =>
        assertSucceeds(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .doc("1")
            .get()
        ));
      it("Deny to read a single consumption if auth uid not matches", () =>
        assertFails(
          authenticatedContext.firestore().collection("users").doc("1").collection("consumptions").doc("1").get()
        ));
      it("Allow to list all consumptions if auth uid matches", () =>
        assertSucceeds(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .get()
        ));
      it("Deny to list all consumptions if auth uid not matches", () =>
        assertFails(authenticatedContext.firestore().collection("users").doc("1").collection("consumptions").get()));
      it("Allow to create a consumption if auth uid matches", () =>
        assertSucceeds(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .add({})
        ));
      it("Deny to create a consumption if auth uid not matches", () =>
        assertFails(authenticatedContext.firestore().collection("users").doc("1").collection("consumptions").add({})));
      it("Allow to update a consumption", async () => {
        await testEnvironment.withSecurityRulesDisabled((context) =>
          context
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .doc("1")
            .set({})
        );
        await assertSucceeds(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .doc("1")
            .update({})
        );
      });
      it("Deny to update a consumption if auth uid not matches", () =>
        assertFails(
          authenticatedContext.firestore().collection("users").doc("1").collection("consumptions").doc("1").update({})
        ));
      it("Allow to delete a consumption if auth uid matches", () =>
        assertSucceeds(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .doc("1")
            .delete()
        ));
      it("Deny to delete a consumption if auth uid not matches", () =>
        assertFails(
          authenticatedContext.firestore().collection("users").doc("1").collection("consumptions").doc("1").delete()
        ));
    });
  });

  describe("/users/consumption-summaries", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single consumption-summary", () =>
        assertFails(
          unauthenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc("1")
            .get()
        ));
      it("Deny to list all consumption-summaries", () =>
        assertFails(
          unauthenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumption-summaries")
            .get()
        ));
      it("Deny to create a consumption-summary", () =>
        assertFails(
          unauthenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumption-summaries")
            .add({})
        ));
      it("Deny to update a consumption-summary", () =>
        assertFails(
          unauthenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc("1")
            .update({})
        ));
      it("Deny to delete a consumption-summary", () =>
        assertFails(
          unauthenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc("1")
            .delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single consumption-summary if auth uid matches", () =>
        assertSucceeds(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc("1")
            .get()
        ));
      it("Deny to read a single consumption-summary if auth uid not matches", () =>
        assertFails(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc("1")
            .collection("consumption-summaries")
            .doc("1")
            .get()
        ));
      it("Allow to list all consumption-summaries if auth uid matches", () =>
        assertSucceeds(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumption-summaries")
            .get()
        ));
      it("Deny to list all consumption-summaries if auth uid not matches", () =>
        assertFails(
          authenticatedContext.firestore().collection("users").doc("1").collection("consumption-summaries").get()
        ));
      it("Deny to create a consumption-summary", () =>
        assertFails(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumption-summaries")
            .add({})
        ));
      it("Deny to update a consumption-summary", () =>
        assertFails(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc("1")
            .update({})
        ));
      it("Deny to delete a consumption-summary", () =>
        assertFails(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc("1")
            .delete()
        ));
    });
  });
});
