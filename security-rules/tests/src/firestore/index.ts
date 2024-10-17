import { assertFails, assertSucceeds, HostAndPort, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { setLogLevel } from "@firebase/firestore";
import * as fs from "fs";
import { TestContext } from "../utils/test-context";
import * as http from "http";
import { generateRandomString } from "../utils/generate-random-string";

let testContext: TestContext;

describe("Firestore Security Rules", () => {
  before(async () => {
    setLogLevel("error");
    const authenticatedContextUserId = generateRandomString();
    const testEnvironment = await initializeTestEnvironment({
      firestore: {
        rules: fs.readFileSync("../firestore.rules", "utf8"),
      },
    });
    testContext = {
      authenticatedContextUserId: authenticatedContextUserId,
      testEnvironment: testEnvironment,
      authenticatedContext: () => testEnvironment.authenticatedContext(authenticatedContextUserId),
      unauthenticatedContext: () => testEnvironment.unauthenticatedContext(),
    };
  });

  beforeEach(() => testContext.testEnvironment.clearFirestore());

  after(async () => {
    await testContext.testEnvironment.cleanup();
    const coverageFile = "firestore-coverage.html";
    const fstream = fs.createWriteStream(coverageFile);
    await new Promise((resolve, reject) => {
      const { host, port } = testContext.testEnvironment.emulators.firestore as HostAndPort;
      const quotedHost = host.includes(":") ? `[${host}]` : host;
      http.get(
        `http://${quotedHost}:${port}/emulator/v1/projects/${testContext.testEnvironment.projectId}:ruleCoverage.html`,
        (response) => {
          response.pipe(fstream, { end: true });
          response.on("end", resolve);
          response.on("error", reject);
        }
      );
    });
    console.log(`\nView firestore rule coverage information at ${coverageFile}\n`);
  });

  describe("/", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single document", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection(generateRandomString())
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to list all documents", () =>
        assertFails(testContext.unauthenticatedContext().firestore().collection(generateRandomString()).get()));
      it("Deny to create a document", () =>
        assertFails(testContext.unauthenticatedContext().firestore().collection(generateRandomString()).add({})));
      it("Deny to update a document", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection(generateRandomString())
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a document", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection(generateRandomString())
            .doc(generateRandomString())
            .delete()
        ));
    });
    describe("Authorized User", () => {
      it("Deny to read a single document", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection(generateRandomString())
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to list all documents", () =>
        assertFails(testContext.authenticatedContext().firestore().collection(generateRandomString()).get()));
      it("Deny to create a document", () =>
        assertFails(testContext.authenticatedContext().firestore().collection(generateRandomString()).add({})));
      it("Deny to update a document", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection(generateRandomString())
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a document", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection(generateRandomString())
            .doc(generateRandomString())
            .delete()
        ));
    });
  });

  describe("/countries", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single country", () =>
        assertFails(
          testContext.unauthenticatedContext().firestore().collection("countries").doc(generateRandomString()).get()
        ));
      it("Deny to list all countries", () =>
        assertFails(testContext.unauthenticatedContext().firestore().collection("countries").get()));
      it("Deny to create a country", () =>
        assertFails(testContext.unauthenticatedContext().firestore().collection("countries").add({})));
      it("Deny to update a country", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("countries")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a country", () =>
        assertFails(
          testContext.unauthenticatedContext().firestore().collection("countries").doc(generateRandomString()).delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single country", () =>
        assertSucceeds(
          testContext.authenticatedContext().firestore().collection("countries").doc(generateRandomString()).get()
        ));
      it("Allow to list all countries", () =>
        assertSucceeds(testContext.authenticatedContext().firestore().collection("countries").get()));
      it("Deny to create a country", () =>
        assertFails(testContext.authenticatedContext().firestore().collection("countries").add({})));
      it("Deny to update a country", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("countries").doc(generateRandomString()).update({})
        ));
      it("Deny to delete a country", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("countries").doc(generateRandomString()).delete()
        ));
    });
  });

  describe("/countries/cities", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single city", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("countries")
            .doc(generateRandomString())
            .collection("cities")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to list all cities", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("countries")
            .doc(generateRandomString())
            .collection("cities")
            .get()
        ));
      it("Deny to create a city", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("countries")
            .doc(generateRandomString())
            .collection("cities")
            .add({})
        ));
      it("Deny to update a city", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("countries")
            .doc(generateRandomString())
            .collection("cities")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a city", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("countries")
            .doc(generateRandomString())
            .collection("cities")
            .doc(generateRandomString())
            .delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single city", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("countries")
            .doc(generateRandomString())
            .collection("cities")
            .doc(generateRandomString())
            .get()
        ));
      it("Allow to list all cities", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("countries")
            .doc(generateRandomString())
            .collection("cities")
            .get()
        ));
      it("Deny to create a city", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("countries")
            .doc(generateRandomString())
            .collection("cities")
            .add({})
        ));
      it("Deny to update a city", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("countries")
            .doc(generateRandomString())
            .collection("cities")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a city", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("countries")
            .doc(generateRandomString())
            .collection("cities")
            .doc(generateRandomString())
            .delete()
        ));
    });
  });

  describe("/user-roles", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single user role", () =>
        assertFails(
          testContext.unauthenticatedContext().firestore().collection("user-roles").doc(generateRandomString()).get()
        ));
      it("Deny to list all user roles", () =>
        assertFails(testContext.unauthenticatedContext().firestore().collection("user-roles").get()));
      it("Deny to create a user role", () =>
        assertFails(testContext.unauthenticatedContext().firestore().collection("user-roles").add({})));
      it("Deny to update a user role", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("user-roles")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a user role", () =>
        assertFails(
          testContext.unauthenticatedContext().firestore().collection("user-roles").doc(generateRandomString()).delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single user role if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("user-roles")
            .doc(testContext.authenticatedContextUserId)
            .get()
        ));
      it("Deny to read a single user role if auth uid not matches", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("user-roles").doc(generateRandomString()).get()
        ));
      it("Deny to list all user roles", () =>
        assertFails(testContext.authenticatedContext().firestore().collection("user-roles").get()));
      it("Deny to create a user role", () =>
        assertFails(testContext.authenticatedContext().firestore().collection("user-roles").add({})));
      it("Deny to update a user role", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("user-roles").doc(generateRandomString()).update({})
        ));
      it("Deny to delete a user role", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("user-roles").doc(generateRandomString()).delete()
        ));
    });
  });

  describe("/_export-user-data-blacklisted-users", () => {
    describe("Unauthenticated User", () => {
      it("Deny to read a single document", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("_export-user-data-blacklisted-users")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to list all documents", () =>
        assertFails(
          testContext.unauthenticatedContext().firestore().collection("_export-user-data-blacklisted-users").get()
        ));
      it("Deny to create a document", () =>
        assertFails(
          testContext.unauthenticatedContext().firestore().collection("_export-user-data-blacklisted-users").add({})
        ));
      it("Deny to update a document", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("_export-user-data-blacklisted-users")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a document", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("_export-user-data-blacklisted-users")
            .doc(generateRandomString())
            .delete()
        ));
    });

    describe("Authenticated User", () => {
      it("Deny to read a single document", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("_export-user-data-blacklisted-users")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to list all documents", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("_export-user-data-blacklisted-users").get()
        ));
      it("Deny to create a document", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("_export-user-data-blacklisted-users").add({})
        ));
      it("Deny to update a document", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("_export-user-data-blacklisted-users")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a document", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("_export-user-data-blacklisted-users")
            .doc(generateRandomString())
            .delete()
        ));
    });

    describe("Admin User", () => {
      beforeEach(async () => {
        await testContext.testEnvironment.withSecurityRulesDisabled((context) =>
          context
            .firestore()
            .collection("user-roles")
            .doc(testContext.authenticatedContextUserId)
            .set({ isAdmin: true })
        );
      });

      it("Allow to read a single document", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("_export-user-data-blacklisted-users")
            .doc(generateRandomString())
            .get()
        ));
      it("Allow to list all documents", () =>
        assertSucceeds(
          testContext.authenticatedContext().firestore().collection("_export-user-data-blacklisted-users").get()
        ));
      it("Allow to create a document", () =>
        assertSucceeds(
          testContext.authenticatedContext().firestore().collection("_export-user-data-blacklisted-users").add({})
        ));
      it("Allow to update a document", async () => {
        const docId = generateRandomString();
        await testContext.testEnvironment.withSecurityRulesDisabled((context) =>
          context.firestore().collection("_export-user-data-blacklisted-users").doc(docId).set({})
        );
        await assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("_export-user-data-blacklisted-users")
            .doc(docId)
            .update({})
        );
      });
      it("Allow to delete a document", async () => {
        const docId = generateRandomString();
        await testContext.testEnvironment.withSecurityRulesDisabled((context) =>
          context.firestore().collection("_export-user-data-blacklisted-users").doc(docId).set({})
        );
        await assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("_export-user-data-blacklisted-users")
            .doc(docId)
            .delete()
        );
      });
    });
  });

  describe("/pv-plants", () => {
    describe("Unauthorized User", () => {
      it("Allow to read a single pv plant", () =>
        assertSucceeds(
          testContext.unauthenticatedContext().firestore().collection("pv-plants").doc(generateRandomString()).get()
        ));
      it("Allow to list all pv-plants", () =>
        assertSucceeds(testContext.unauthenticatedContext().firestore().collection("pv-plants").get()));
      it("Deny to create a pv-plant", () =>
        assertFails(testContext.unauthenticatedContext().firestore().collection("pv-plants").add({})));
      it("Deny to update a pv-plant", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("pv-plants")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a pv-plant", () =>
        assertFails(
          testContext.unauthenticatedContext().firestore().collection("pv-plants").doc(generateRandomString()).delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single pv plant", () =>
        assertSucceeds(
          testContext.authenticatedContext().firestore().collection("pv-plants").doc(generateRandomString()).get()
        ));
      it("Allow to list all pv plants", () =>
        assertSucceeds(testContext.authenticatedContext().firestore().collection("pv-plants").get()));
      it("Deny to create a pv plant", () =>
        assertFails(testContext.authenticatedContext().firestore().collection("pv-plants").add({})));
      it("Deny to update a pv plant", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("pv-plants").doc(generateRandomString()).update({})
        ));
      it("Deny to delete a pv plant", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("pv-plants").doc(generateRandomString()).delete()
        ));
    });
  });

  describe("/pv-plants/data", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single pv plant data", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("pv-plants")
            .doc(generateRandomString())
            .collection("data")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to list all pv plant data", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("pv-plants")
            .doc(generateRandomString())
            .collection("data")
            .get()
        ));
      it("Deny to create a pv plant data", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("pv-plants")
            .doc(generateRandomString())
            .collection("data")
            .add({})
        ));
      it("Deny to update a pv plant data", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("pv-plants")
            .doc(generateRandomString())
            .collection("data")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a pv plant data", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("pv-plants")
            .doc(generateRandomString())
            .collection("data")
            .doc(generateRandomString())
            .delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single pv plant data", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("pv-plants")
            .doc(generateRandomString())
            .collection("data")
            .doc(generateRandomString())
            .get()
        ));
      it("Allow to list all pv plant data", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("pv-plants")
            .doc(generateRandomString())
            .collection("data")
            .get()
        ));
      it("Deny to create a pv plant data", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("pv-plants")
            .doc(generateRandomString())
            .collection("data")
            .add({})
        ));
      it("Deny to update a pv plant data", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("pv-plants")
            .doc(generateRandomString())
            .collection("data")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a pv plant data", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("pv-plants")
            .doc(generateRandomString())
            .collection("data")
            .doc(generateRandomString())
            .delete()
        ));
    });
  });

  describe("/users", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single user", () =>
        assertFails(
          testContext.unauthenticatedContext().firestore().collection("users").doc(generateRandomString()).get()
        ));
      it("Deny to list all users", () =>
        assertFails(testContext.unauthenticatedContext().firestore().collection("users").get()));
      it("Deny to create a user", () =>
        assertFails(testContext.unauthenticatedContext().firestore().collection("users").add({})));
      it("Deny to update a user", () =>
        assertFails(
          testContext.unauthenticatedContext().firestore().collection("users").doc(generateRandomString()).update({})
        ));
      it("Deny to delete a user", () =>
        assertFails(
          testContext.unauthenticatedContext().firestore().collection("users").doc(generateRandomString()).delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single user if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .get()
        ));
      it("Deny to read a single user if auth uid not matches", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("users").doc(generateRandomString()).get()
        ));
      it("Deny to list all users", () =>
        assertFails(testContext.authenticatedContext().firestore().collection("users").get()));
      it("Allow to create a user if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .set({})
        ));
      it("Deny to create a user if auth uid not matches", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("users").doc(generateRandomString()).set({})
        ));
      it("Allow to update a user if auth uid matches", async () => {
        await testContext.testEnvironment.withSecurityRulesDisabled((context) =>
          context.firestore().collection("users").doc(testContext.authenticatedContextUserId).set({})
        );
        await assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .update({})
        );
      });
      it("Deny to update a user if auth uid not matches", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("users").doc(generateRandomString()).update({})
        ));
      it("Deny to delete a user", () =>
        assertFails(
          testContext.authenticatedContext().firestore().collection("users").doc(generateRandomString()).delete()
        ));
    });
  });

  describe("/users/consumptions", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single consumption", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumptions")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to list all consumptions", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumptions")
            .get()
        ));
      it("Deny to create a consumption", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumptions")
            .add({})
        ));
      it("Deny to update a consumption", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumptions")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a consumption", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumptions")
            .doc(generateRandomString())
            .delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single consumption if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumptions")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to read a single consumption if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("consumptions")
            .doc(generateRandomString())
            .get()
        ));
      it("Allow to list all consumptions if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumptions")
            .get()
        ));
      it("Deny to list all consumptions if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("consumptions")
            .get()
        ));
      it("Allow to create a consumption if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumptions")
            .add({})
        ));
      it("Deny to create a consumption if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("consumptions")
            .add({})
        ));
      it("Allow to update a consumption", async () => {
        const consumptionId = generateRandomString();
        await testContext.testEnvironment.withSecurityRulesDisabled((context) =>
          context
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumptions")
            .doc(consumptionId)
            .set({})
        );
        await assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumptions")
            .doc(consumptionId)
            .update({})
        );
      });
      it("Deny to update a consumption if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("consumptions")
            .doc(generateRandomString())
            .update({})
        ));
      it("Allow to delete a consumption if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumptions")
            .doc(generateRandomString())
            .delete()
        ));
      it("Deny to delete a consumption if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("consumptions")
            .doc(generateRandomString())
            .delete()
        ));
    });
  });

  describe("/users/consumption-summaries", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single consumption-summary", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to list all consumption-summaries", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumption-summaries")
            .get()
        ));
      it("Deny to create a consumption-summary", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumption-summaries")
            .add({})
        ));
      it("Deny to update a consumption-summary", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a consumption-summary", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc(generateRandomString())
            .delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single consumption-summary if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to read a single consumption-summary if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("consumption-summaries")
            .doc(generateRandomString())
            .get()
        ));
      it("Allow to list all consumption-summaries if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumption-summaries")
            .get()
        ));
      it("Deny to list all consumption-summaries if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("consumption-summaries")
            .get()
        ));
      it("Deny to create a consumption-summary", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumption-summaries")
            .add({})
        ));
      it("Deny to update a consumption-summary", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a consumption-summary", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("consumption-summaries")
            .doc(generateRandomString())
            .delete()
        ));
    });
  });

  describe("/users/recurring-consumptions", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single recurring consumption", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("recurring-consumptions")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to list all recurring consumptions", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("recurring-consumptions")
            .get()
        ));
      it("Deny to create a consumption", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("recurring-consumptions")
            .add({})
        ));
      it("Deny to update a recurring consumption", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("recurring-consumptions")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a recurring consumption", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("recurring-consumptions")
            .doc(generateRandomString())
            .delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single recurring consumption if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("recurring-consumptions")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to read a single recurring consumption if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("recurring-consumptions")
            .doc(generateRandomString())
            .get()
        ));
      it("Allow to list all recurring consumptions if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("recurring-consumptions")
            .get()
        ));
      it("Deny to list all recurring consumptions if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("recurring-consumptions")
            .get()
        ));
      it("Allow to create a recurring consumption if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("recurring-consumptions")
            .add({})
        ));
      it("Deny to create a recurring consumption if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("recurring-consumptions")
            .add({})
        ));
      it("Allow to update a recurring consumption", async () => {
        const recurringConsumptionId = generateRandomString();
        await testContext.testEnvironment.withSecurityRulesDisabled((context) =>
          context
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("recurring-consumptions")
            .doc(recurringConsumptionId)
            .set({})
        );
        await assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("recurring-consumptions")
            .doc(recurringConsumptionId)
            .update({})
        );
      });
      it("Deny to update a recurring consumption if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("recurring-consumptions")
            .doc(generateRandomString())
            .update({})
        ));
      it("Allow to delete a recurring consumption if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("recurring-consumptions")
            .doc(generateRandomString())
            .delete()
        ));
      it("Deny to delete a recurring consumption if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("recurring-consumptions")
            .doc(generateRandomString())
            .delete()
        ));
    });
  });

  describe("/users/pv-investments", () => {
    describe("Unauthorized User", () => {
      it("Deny to read a single pv investment", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("pv-investments")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to list all pv investments", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("pv-investments")
            .get()
        ));
      it("Deny to create a pv investment", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("pv-investments")
            .add({})
        ));
      it("Deny to update a pv investment", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("pv-investments")
            .doc(generateRandomString())
            .update({})
        ));
      it("Deny to delete a pv investment", () =>
        assertFails(
          testContext
            .unauthenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("pv-investments")
            .doc(generateRandomString())
            .delete()
        ));
    });
    describe("Authorized User", () => {
      it("Allow to read a single pv investment if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("pv-investments")
            .doc(generateRandomString())
            .get()
        ));
      it("Deny to read a single pv investment if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("pv-investments")
            .doc(generateRandomString())
            .get()
        ));
      it("Allow to list all pv investments if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("pv-investments")
            .get()
        ));
      it("Deny to list all pv investments if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("pv-investments")
            .get()
        ));
      it("Allow to create a pv investment if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("pv-investments")
            .add({})
        ));
      it("Deny to create a pv investment if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("pv-investments")
            .add({})
        ));
      it("Allow to update a pv investment", async () => {
        const recurringConsumptionId = generateRandomString();
        await testContext.testEnvironment.withSecurityRulesDisabled((context) =>
          context
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("pv-investments")
            .doc(recurringConsumptionId)
            .set({})
        );
        await assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("pv-investments")
            .doc(recurringConsumptionId)
            .update({})
        );
      });
      it("Deny to update a pv investment if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("pv-investments")
            .doc(generateRandomString())
            .update({})
        ));
      it("Allow to delete a pv investment if auth uid matches", () =>
        assertSucceeds(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(testContext.authenticatedContextUserId)
            .collection("pv-investments")
            .doc(generateRandomString())
            .delete()
        ));
      it("Deny to delete a pv investment if auth uid not matches", () =>
        assertFails(
          testContext
            .authenticatedContext()
            .firestore()
            .collection("users")
            .doc(generateRandomString())
            .collection("pv-investments")
            .doc(generateRandomString())
            .delete()
        ));
    });
  });
});
