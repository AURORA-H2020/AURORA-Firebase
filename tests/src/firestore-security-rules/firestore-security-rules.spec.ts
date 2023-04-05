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
    describe("Authorized User", () => {
      it("Allow to create a consumption if auth uid matches", () =>
        assertSucceeds(
          authenticatedContext
            .firestore()
            .collection("users")
            .doc(authenticatedContextUserId)
            .collection("consumptions")
            .add({})
        ));
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
    });
  });
});
