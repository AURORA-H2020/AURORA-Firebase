# Demosites (`sites`)
Each user is related to a demosite, which determines key variables for their carbon footprint calculations. Each demosite document holds the following fields:
- `city`
- `countryCode`
- `publicTransportEmission`
  - `busEmission`
  - `trainEmission`
  - `...`

# Users (`users`)
The `users` collection stores all data about each user with an account.

## General User Data
All personal information stored for this user.
- `gender` -> `[male, female, non-binary]`
- `firstName`
- `lastName`
- `site` -> unique ID of corresponding Demosite
- `yearOfBirth` -> INT
- `households` -> List of households (to be defined)
- `customVehicles`
  - `type` -> `[fuelCar, electricCar, eBike, bike, motorBike, ...]`
  - `name` -> Custom name for the vehicle displayed to user.
  - `consumption` -> FLOAT of consumption. In liters of fuel for fuel powered vehicles and kWh for electric vehicles. No fuel vehicles like `bike` automatically set to `0`.

## Settings
All settings stored for this user (to be defined)
- `...`

## Emission Data
All emission data is compiled as a collection of `entries`. The three different types of emission are distinguished by their `category`. The following fields are consistent for all categories. Fields unique to specific categories are listed below under each `category`.

- `category` -> `[electricity, transportation, heating]`
- `carbonEmission` -> FLOAT in unit of kg CO<sub>2</sub>. This value is calculated by a cloud function, based on category specific entries.
- `entryDateTime` -> Timestamp of entry Datetime.
- `startDate` -> Start date of the consumption (e.g. period start date for electricity bill)
- `endDate` -> End date of the consumption (e.g. period end date for electricity bill)

### `category` -> `electricity`
- `value` -> FLOAT in unit of kWh entered directly by the user.
- `type` -> `[solar, coal, ...]` This value defaults to what is set as the main household's electricity type.

### `category` -> `heating`
- `value` -> FLOAT in unit of kWh entered directly by the user.
- `type` -> `[gas, district, ...]` This value defaults to what is set as the main household's heating type.

### `category` -> `transportation`
- `value` -> FLOAT in unit of distance in kilometers entered directly by the user.
- `type` -> Vehicle type, same as `customVehicles.type`. Also shows all custom `vehicles` the user created.
