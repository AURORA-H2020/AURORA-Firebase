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

  afterEach(() => testEnvironment.cleanup());

  describe("/sites", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single site", () =>
        assertFails(unauthenticatedContext.firestore().collection("sites").doc("1").get()));
      it("Deny to list all sites", () => assertFails(unauthenticatedContext.firestore().collection("sites").get()));
      it("Deny to create a site", () => assertFails(unauthenticatedContext.firestore().collection("sites").add({})));
      it("Deny to update a site", () =>
        assertFails(unauthenticatedContext.firestore().collection("sites").doc("1").update({})));
      it("Deny to delete a site", () =>
        assertFails(unauthenticatedContext.firestore().collection("sites").doc("1").delete()));
    });
    describe("Authorized User", () => {
      it("Deny to read a single site", () =>
        assertFails(authenticatedContext.firestore().collection("sites").doc("1").get()));
      it("Allow to list all sites", () => assertSucceeds(authenticatedContext.firestore().collection("sites").get()));
      it("Deny to create a site", () => assertFails(authenticatedContext.firestore().collection("sites").add({})));
      it("Deny to update a site", () =>
        assertFails(authenticatedContext.firestore().collection("sites").doc("1").update({})));
      it("Deny to delete a site", () =>
        assertFails(authenticatedContext.firestore().collection("sites").doc("1").delete()));
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
      it("Deny to update a user if auth uid matches but consumptionSummary has been changed", () =>
        assertFails(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .update({ consumptionSummary: {} })
        ));
      it("Deny to update a user if auth uid not matches", () =>
        assertFails(authenticatedContext.firestore().collection("users").doc("1").update({})));
      it("Deny to delete a user", () =>
        assertFails(authenticatedContext.firestore().collection("users").doc("1").delete()));
    });
  });
});
