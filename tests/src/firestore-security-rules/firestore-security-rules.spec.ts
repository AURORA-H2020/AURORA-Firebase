import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";

// The RulesTestEnvironment
let testEnvironment: RulesTestEnvironment;

beforeEach(async () => {
  if (!testEnvironment) {
    testEnvironment = await initializeTestEnvironment({
      projectId: "aurora-firestore-security-rules-tests",
      firestore: {
        rules: fs.readFileSync("../firestore.rules", "utf8"),
      },
    });
  }
});

afterEach(() => testEnvironment.cleanup());

describe("sites Collection", () => {
  test("Deny to read a single site", async () =>
    await assertFails(testEnvironment.unauthenticatedContext().firestore().collection("sites").doc("1").get()));
  test("Allow to list all sites", async () =>
    await assertSucceeds(testEnvironment.unauthenticatedContext().firestore().collection("sites").get()));
  test("Deny to create a site", async () =>
    await assertFails(testEnvironment.unauthenticatedContext().firestore().collection("sites").add({})));
  test("Deny to update a site", async () =>
    await assertFails(testEnvironment.unauthenticatedContext().firestore().collection("sites").doc("1").update({})));
  test("Deny to delete a site", async () =>
    await assertFails(testEnvironment.unauthenticatedContext().firestore().collection("sites").doc("1").delete()));
});
