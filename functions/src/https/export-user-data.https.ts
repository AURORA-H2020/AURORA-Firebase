import { region } from "firebase-functions";
import { preferredRegion } from "../constants";

export default region(preferredRegion).https.onCall(async (data, context) => {
  // TODO: Retrieve all User Data and send an export to the mail address
  console.log(data, context, context.auth?.token.email);
});
