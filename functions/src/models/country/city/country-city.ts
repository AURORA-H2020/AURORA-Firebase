/**
 * A city in a country
 */
export interface CountryCity {
  /**
   * The name
   */
  name: string;
  /**
   * Whether the PV feature is enabled
   */
  hasPhotovoltaics?: boolean;
  /**
   * Parameters for pvgis API
   */
  pvgisParams?: {
    /**
     * The latitude
     */
    lat: number;
    /**
     * The longitude
     */
    long: number;
    /**
     * The angle
     */
    angle: number;
    /**
     * The aspect
     */
    aspect: number;
    /**
     * The investment factor
     */
    investmentFactor: number;
  };
}
