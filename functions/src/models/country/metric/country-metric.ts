import { Timestamp } from "firebase-admin/firestore";

/**
 * A country metric
 */
export interface CountryMetric {
  validFrom: Timestamp;
  electricity: CountryMetricElectricity;
  heating: CountryMetricHeating;
  transportation: CountryMetricTransportation;
  transportationEnergy: CountryMetricTransportation;
}

export interface CountryMetricElectricity {
  default: number;
  defaultGreenProvider: number;
  homePhotovoltaics: number;
}

export interface CountryMetricHeatingEntry {
  carbon: number;
  energy: number;
  unit: "kWh" | "kg" | "l";
}

export interface CountryMetricHeating {
  biomass: CountryMetricHeatingEntry;
  coal: CountryMetricHeatingEntry;
  default: CountryMetricHeatingEntry;
  district: CountryMetricHeatingEntry;
  districtDefault: CountryMetricHeatingEntry;
  electric: CountryMetricHeatingEntry;
  geothermal: CountryMetricHeatingEntry;
  liquifiedPetroGas: CountryMetricHeatingEntry;
  locallyProducedBiomass: CountryMetricHeatingEntry;
  naturalGas: CountryMetricHeatingEntry;
  oil: CountryMetricHeatingEntry;
  solarThermal: CountryMetricHeatingEntry;
  wasteTreatment: CountryMetricHeatingEntry;
  firewood: CountryMetricHeatingEntry;
  butane: CountryMetricHeatingEntry;
}

export interface CountryMetricTransportation {
  fuelCar: {
    1?: number;
    2?: number;
    3?: number;
    4?: number;
    5?: number;
  };
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
