import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";

let testEnvironment: RulesTestEnvironment;

beforeEach(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: "aurora-firestore-security-rules-tests",
    firestore: {
      rules: fs.readFileSync("../firestore.rules", "utf8"),
    },
  });
});

afterEach(() => testEnvironment.cleanup());

describe("Unauthorized User", () => {
  describe("sites Collection", () => {
    const context = testEnvironment.unauthenticatedContext();
    it("Deny to read a single site", async () =>
      await assertFails(context.firestore().collection("sites").doc("1").get()));
    it("Allow to list all sites", async () => await assertSucceeds(context.firestore().collection("sites").get()));
    it("Deny to create a site", async () => await assertFails(context.firestore().collection("sites").add({})));
    it("Deny to update a site", async () =>
      await assertFails(context.firestore().collection("sites").doc("1").update({})));
    it("Deny to delete a site", async () =>
      await assertFails(context.firestore().collection("sites").doc("1").delete()));
  });
});
