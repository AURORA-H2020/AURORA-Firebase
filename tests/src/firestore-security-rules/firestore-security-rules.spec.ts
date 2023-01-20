import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestContext,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";

describe("Firestore Security Rules", () => {
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
    authenticatedContext = testEnvironment.authenticatedContext("USER_ID");
    unauthenticatedContext = testEnvironment.unauthenticatedContext();
  });

  afterEach(() => testEnvironment.cleanup());

  describe("/sites", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single site", async () =>
        await assertFails(unauthenticatedContext.firestore().collection("sites").doc("1").get()));
      it("Deny to list all sites", async () =>
        await assertFails(unauthenticatedContext.firestore().collection("sites").get()));
      it("Deny to create a site", async () =>
        await assertFails(unauthenticatedContext.firestore().collection("sites").add({})));
      it("Deny to update a site", async () =>
        await assertFails(unauthenticatedContext.firestore().collection("sites").doc("1").update({})));
      it("Deny to delete a site", async () =>
        await assertFails(unauthenticatedContext.firestore().collection("sites").doc("1").delete()));
    });
    describe("Authorized User", () => {
      it("Deny to read a single site", async () =>
        await assertFails(authenticatedContext.firestore().collection("sites").doc("1").get()));
      it("Allow to list all sites", async () =>
        await assertSucceeds(authenticatedContext.firestore().collection("sites").get()));
      it("Deny to create a site", async () =>
        await assertFails(authenticatedContext.firestore().collection("sites").add({})));
      it("Deny to update a site", async () =>
        await assertFails(authenticatedContext.firestore().collection("sites").doc("1").update({})));
      it("Deny to delete a site", async () =>
        await assertFails(authenticatedContext.firestore().collection("sites").doc("1").delete()));
    });
  });
});
