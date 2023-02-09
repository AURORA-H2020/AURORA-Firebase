import { Timestamp } from "firebase-admin/firestore";

export interface CountryMetric {
  validFrom: Timestamp;
  electricity: {
    default: number;
  },
  heating: {
    oil: number;
    naturalGas: number;
    liquifiedPetroGas: number;
    biomass: number;
    locallyProducedBiomass: number;
    geothermal: number;
    solarThermal: number;
    district: number;
    electric: number;
    coal: number;
    wasteTreatment: number;
    default: number;
  }
  transportation: {
    fuelCar: {
      1?: number;
      2?: number;
      3?: number;
      4?: number;
      5?: number;
    }
    electricCar: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    hybridCar: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    motorcycle: {
      1: number;
      2: number;
    };
    electricMotorcycle: {
      1: number;
      2: number;
    };
    electricBus: {
      almostEmpty: number;
      medium: number;
      nearlyFull: number;
    };
    hybridElectricBus: {
      almostEmpty: number;
      medium: number;
      nearlyFull: number;
    };
    alternativeFuelBus: {
      almostEmpty: number;
      medium: number;
      nearlyFull: number;
    };
    dieselBus: {
      almostEmpty: number;
      medium: number;
      nearlyFull: number;
    };
    otherBus: {
      almostEmpty: number;
      medium: number;
      nearlyFull: number;
    };
    metroTramOrUrbanLightTrain: {
      almostEmpty: number;
      medium: number;
      nearlyFull: number;
    };
    electricPassengerTrain: {
      almostEmpty: number;
      medium: number;
      nearlyFull: number;
    };
    dieselPassengerTrain: {
      almostEmpty: number;
      medium: number;
      nearlyFull: number;
    };
    highSpeedTrain: {
      almostEmpty: number;
      medium: number;
      nearlyFull: number;
    };
    plane: {
      1: number;
    };
    electricBike: {
      1: number;
    };
    electricScooter: {
      1: number;
    };
    bike: {
      1: number;
    };
    walking: {
      1: number;
    };
  }
}
