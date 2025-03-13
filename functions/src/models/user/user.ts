import type { UserConsumptionMetadata } from "./user-consumption-metadata";
import type { UserGender } from "./user-gender";
import type { UserHomeEnergyLabel } from "./user-homeEnergyLabel";
import type { UserHouseholdProfile } from "./user-householdProfile";
import type { UserSettings } from "./user-settings/user-settings";

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
	 * The home energy label
	 */
	homeEnergyLabel?: UserHomeEnergyLabel;
	/**
	 * The household profile
	 */
	householdProfile?: UserHouseholdProfile;
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
	/**
	 * Whether marketing consent is provided
	 */
	isMarketingConsentAllowed?: boolean;
	/**
	 * The last accepted legal document version
	 */
	acceptedLegalDocumentVersion?: number;
	/**
	 * The user settings
	 */
	settings?: UserSettings;
}
