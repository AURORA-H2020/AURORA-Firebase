import { Timestamp } from "firebase-admin/firestore";

export interface UserPvInvestment {
  /**
   * The user's monetary investment in the installation
   */
  investmentPrice?: number;
  /**
   * The user's investment capacity in the installation in kW
   */
  investmentCapacity?: number;
  /**
   * The user's share in the installation
   */
  share: number;
  /**
   * The user's investment date
   */
  investmentDate: Timestamp;
  /**
   * The city the invested installation is located in
   */
  city: string;
  /**
   * The PV installation ID
   */
  pvPlant: string;
  /**
   * The user's note about the investment
   */
  note?: string;
  /**
   * The time the investment was created
   */
  createdAt: Timestamp;
  /**
   * The time the investment was last updated
   */
  updatedAt: Timestamp;
}
