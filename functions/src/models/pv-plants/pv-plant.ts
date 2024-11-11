import { Timestamp } from "firebase-admin/firestore";

export interface PvPlant {
  /**
   * PV installation ID
   */
  plantId: string;
  /**
   * The name of the PV installation
   */
  name: string;
  /**
   * The date the PV installation was first operational
   */
  installationDate?: Timestamp;
  /**
   * The country of the PV installation
   */
  country: string;
  /**
   * The city of the PV installation
   */
  city: string;
  /**
   * The manufacturer of the PV installation
   */
  manufacturer?: string;
  /**
   * The technology of the PV installation
   */
  technology?: string;
  /**
   * The capacity of the PV installation in kW
   */
  capacity?: number;
  /**
   * The price per share
   */
  pricePerShare: number;
  /**
   * The kW per share
   */
  kwPerShare: number;
  /**
   * The status of the PV installation
   */
  active: boolean;
  /**
   * The URL to the investment guide
   */
  infoURL?: string;
}
