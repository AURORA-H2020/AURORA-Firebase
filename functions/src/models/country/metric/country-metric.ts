import { Timestamp } from "firebase-admin/firestore";

/**
 * A country metric
 */
export interface CountryMetric {
  validFrom: Timestamp;
  electricity: CountryMetricElectricity;
  heating: CountryMetricHeating;
  transportation: CountryMetricTransportation;
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

export interface CountryMetricTransportationEntry {
  carbon: number;
  energy: number;
}

export interface CountryMetricTransportation {
  fuelCar: {
    1: CountryMetricTransportationEntry;
    2: CountryMetricTransportationEntry;
    3: CountryMetricTransportationEntry;
    4: CountryMetricTransportationEntry;
    5: CountryMetricTransportationEntry;
  };
  electricCar: {
    1: CountryMetricTransportationEntry;
    2: CountryMetricTransportationEntry;
    3: CountryMetricTransportationEntry;
    4: CountryMetricTransportationEntry;
    5: CountryMetricTransportationEntry;
  };
  hybridCar: {
    1: CountryMetricTransportationEntry;
    2: CountryMetricTransportationEntry;
    3: CountryMetricTransportationEntry;
    4: CountryMetricTransportationEntry;
    5: CountryMetricTransportationEntry;
  };
  motorcycle: {
    1: CountryMetricTransportationEntry;
    2: CountryMetricTransportationEntry;
  };
  electricMotorcycle: {
    1: CountryMetricTransportationEntry;
    2: CountryMetricTransportationEntry;
  };
  electricBus: {
    almostEmpty: CountryMetricTransportationEntry;
    medium: CountryMetricTransportationEntry;
    nearlyFull: CountryMetricTransportationEntry;
  };
  hybridElectricBus: {
    almostEmpty: CountryMetricTransportationEntry;
    medium: CountryMetricTransportationEntry;
    nearlyFull: CountryMetricTransportationEntry;
  };
  alternativeFuelBus: {
    almostEmpty: CountryMetricTransportationEntry;
    medium: CountryMetricTransportationEntry;
    nearlyFull: CountryMetricTransportationEntry;
  };
  dieselBus: {
    almostEmpty: CountryMetricTransportationEntry;
    medium: CountryMetricTransportationEntry;
    nearlyFull: CountryMetricTransportationEntry;
  };
  otherBus: {
    almostEmpty: CountryMetricTransportationEntry;
    medium: CountryMetricTransportationEntry;
    nearlyFull: CountryMetricTransportationEntry;
  };
  metroTramOrUrbanLightTrain: {
    almostEmpty: CountryMetricTransportationEntry;
    medium: CountryMetricTransportationEntry;
    nearlyFull: CountryMetricTransportationEntry;
  };
  electricPassengerTrain: {
    almostEmpty: CountryMetricTransportationEntry;
    medium: CountryMetricTransportationEntry;
    nearlyFull: CountryMetricTransportationEntry;
  };
  dieselPassengerTrain: {
    almostEmpty: CountryMetricTransportationEntry;
    medium: CountryMetricTransportationEntry;
    nearlyFull: CountryMetricTransportationEntry;
  };
  highSpeedTrain: {
    almostEmpty: CountryMetricTransportationEntry;
    medium: CountryMetricTransportationEntry;
    nearlyFull: CountryMetricTransportationEntry;
  };
  plane: {
    1: CountryMetricTransportationEntry;
  };
  planeExtraEu: {
    1: CountryMetricTransportationEntry;
  };
  planeIntraEu: {
    1: CountryMetricTransportationEntry;
  };
  electricBike: {
    1: CountryMetricTransportationEntry;
  };
  electricScooter: {
    1: CountryMetricTransportationEntry;
  };
  bike: {
    1: CountryMetricTransportationEntry;
  };
  walking: {
    1: CountryMetricTransportationEntry;
  };
  customFuel: {
    regular: number;
    electric: number;
  };
}
