import { UserGender } from "./user-gender";
import { UserConsumptionMetadata } from "./user-consumption-metadata";

/**
 * A user
 */
export interface User {
  /**
   * The first name
   */
  firstName: string;
  /**
   * The last name
   */
  lastName: string;
  /**
   * The year of birth
   */
  yearOfBirth?: number;
  /**
   * The gender
   */
  gender?: UserGender;
  /**
   * The consumption metadata
   */
  consumptionMeta?: UserConsumptionMetadata;
  /**
   * The consumption summary metadata
   */
  consumptionSummaryMeta?: UserConsumptionMetadata;
  /**
   * The country identifier
   */
  country: string;
  /**
   * The city in country identifier
   */
  city?: string;
}
