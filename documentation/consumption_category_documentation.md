# Countries (`countries`)
Each user is related to a country, which determines key variables for their carbon footprint calculations. Each country document holds the following fields:
- `countryCode` (String)

And the following collections:
- `cities`
- `metrics`

*Currently only countries of the AURORA project are supported, plus the EU in general. These countries are Denmark, UK, Slovenia, Portugal, and Spain.*

## Cities (`{COUNTRY_ID}.cities`)
Collection with documents for each city, identified by a random ID. Cities are related to `users`. Each city document holds the following fields:
- `name` (String)

*This collection is not available for the EU.*

## Metrics (`countries.metrics`)
Collection with documents for Emission Factor metrics for each country, identified by version number. Cities are related to `users`. Each metric version document holds the following fields:
- `validFrom` (DateTime) -> Indicates the time from which this metric version is valid. Should another document with a more recent `validFrom` exist it is used instead to calculate the carbon emission.
- `electricity` (Map)
  - `default` (Number) -> The default electricity EF for the country. Designed this way to support additional EF values in the future (if needed).
- `heating` (Map) -> EF values for different heating sources selectable in the app.
  - `biomass` (Number)
  - `coal` (Number)
  - `districtDefault` (Number)
  - `geothermal` (Number)
  - `liquifiedPetroGas` (Number)
  - `locallyProducedBiomass` (Number)
  - `naturalGas` (Number)
  - `oil` (Number)
  - `solarThermal` (Number)
  - `wasteTreatment` (Number)
- `transportation` (Map) -> Transportation types with corresponding occupancy levels.
  - `alternativeFuelBus` (Map)
    - `almostEmpty` (Number)
    - `medium` (Number)
    - `nearlyFull` (Number)
  - `bike` (Map)
    - `1` (Number)
  - `dieselBus` (Map)
  - `dieselPassengerTrain` (Map)
  - `electricBike` (Map)
  - `electricBus` (Map)
  - `electricCar` (Map)
  - `electricMotorcycle` (Map)
  - `electricPassengerTrain` (Map)
  - `electricScooter` (Map)
  - `fuelCar` (Map)
  - `highSpeedTrain` (Map)
  - `hybridCar` (Map)
  - `hybridElectricBus` (Map)
  - `metroTramOrUrbanLightTrain` (Map)
  - `motorcycle` (Map)
  - `otherBus` (Map)
  - `plane` (Map)
  - `walking` (Map)


# Users (`users`)
The `users` collection stores all data about each user with an account.

## General User Data
All personal information stored for this user.
- `gender` (String) -> `[male, female, non-binary]`
- `firstName` (String)
- `lastName` (String)
- `country` (String) -> unique ID of corresponding country (`countries`)
- `city` (String) -> unique ID of corresponding city (`{COUNTRY_ID}.cities`)
- `yearOfBirth` (Number) -> INT

The following have not yet been implemented:
- `households` (Map) -> List of households (to be defined)
- `customVehicles` (Map)
  - `type` -> `[fuelCar, electricCar, eBike, bike, motorBike, ...]`
  - `name` -> Custom name for the vehicle displayed to user.
  - `consumption` -> FLOAT of consumption. In liters of fuel for fuel powered vehicles and kWh for electric vehicles. No fuel vehicles like `bike` automatically set to `0`.

## Settings
All settings stored for this user (not implemented)
- `...`

## Consumptions (`{USER_ID}.consumptions`)
Each consumption is stored as a document of the `consumptions` collection. The three different types of emission are distinguished with value of `category`. The following fields are consistent for all categories. Fields unique to specific categories are listed below under each `category`.

- `category` (String) -> `[electricity, transportation, heating]`
- `carbonEmission` (Number) -> As unit of kg CO<sub>2</sub>. This value is calculated by the `calculate-carbon-emission.ts` cloud function, based on category specific entries.
- `createdAt` (DateTime) -> Timestamp when the consumption was first created.
- `updatedAt` (DateTime) -> Timestamp when the consumption was last updated.

### `category` -> `electricity`
- `value` (Number) -> In unit of kWh entered directly by the user.
- `startDate` (DateTime) -> Start date of the consumption (e.g. period start date for electricity bill)
- `endDate` (DateTime) -> End date of the consumption (e.g. period end date for electricity bill)

### `category` -> `heating`
- `value` (Number) -> In unit of kWh entered directly by the user.
- `heatingFuel` (String) -> `[gas, district, ...]`
- `districtHeatingSource` (String) -> `[gas, coal, ...]` -> Only used if `heatingFuel` is set to `district`.
- `startDate` (DateTime) -> Start date of the consumption (e.g. period start date for heating bill)
- `endDate` (DateTime) -> End date of the consumption (e.g. period end date for heating bill)

### `category` -> `transportation`
- `value` (Number) -> In unit of distance in kilometers entered directly by the user.
- `transportationType` (String) -> Type of vehicle used for transportation. This determines which type of occupancy scale is used.
- `privateVehicleOccupancy` (Number) -> Used for all private vehicles
- `publicVehicleOccupancy` (String) -> `[almostEmpty, medium, nearlyFull]` Used for all public vehicles

*For vehicles without an occupancy level, such as `bike`, `walking`, or `plane`, neither `privateVehicleOccupancy` nor `publicVehicleOccupancy` are written.*
