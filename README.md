![AURORA Project Banner](https://www.aurora-h2020.eu/wp-content/uploads/2022/08/Logo-Website.png)

# AURORA Firebase Backend

[![Test Cloud Functions](https://github.com/AURORA-H2020/AURORA-Firebase/actions/workflows/test_cloud_functions.yml/badge.svg)](https://github.com/AURORA-H2020/AURORA-Firebase/actions/workflows/test_cloud_functions.yml)
[![Test Firestore Rules](https://github.com/AURORA-H2020/AURORA-Firebase/actions/workflows/test_firestore_rules.yml/badge.svg)](https://github.com/AURORA-H2020/AURORA-Firebase/actions/workflows/test_firestore_rules.yml)
[![Deploy Cloud Functions](https://github.com/AURORA-H2020/AURORA-Firebase/actions/workflows/deploy_cloud_functions.yml/badge.svg)](https://github.com/AURORA-H2020/AURORA-Firebase/actions/workflows/deploy_cloud_functions.yml)
[![Deploy Firestore Rules](https://github.com/AURORA-H2020/AURORA-Firebase/actions/workflows/deploy_firestore_rules.yml/badge.svg)](https://github.com/AURORA-H2020/AURORA-Firebase/actions/workflows/deploy_firestore_rules.yml)

**[Website](https://www.aurora-h2020.eu/) | [Dashboard](https://dashboard.aurora-h2020.eu)**

## About the Project

**AURORA** is a pioneering Innovation Action funded by the EU’s **Horizon 2020** programme. Starting in December 2021 with €4.6 million in funding, AURORA aims to demonstrate how ordinary citizens can drive the transition to a near-zero emission society.

The project engages approximately **7,000 citizens** across five locations (Denmark, England, Portugal, Slovenia, and Spain) to become "citizen scientists." These communities are not only reducing their own carbon footprint but are also crowd-funding local **photovoltaic (PV) facilities** to produce ~1 megawatt of renewable energy.

This repository contains the **Firebase Backend** logic for the AURORA ecosystem. It serves as the central hub for data processing, authentication, and cloud functions that power the **Web App**, **iOS App**, and **Android App**. It ensures data consistency, security, and handles complex business logic off-device.

## Key Features

*   **Carbon Emission Calculation**: Automated server-side calculation of CO2 emissions based on user consumption data to ensure accuracy and consistency across all platforms.
*   **PV Investment Analysis**: Complex logic to calculate investment returns, energy production, and environmental impact for community solar projects.
*   **Data Management & Privacy**: Automated workflows for user data management, including secure deletion and data export features to ensure GDPR compliance.
*   **Recurring Consumptions**: Background processes that automatically generate consumption entries for recurring user activities (e.g., monthly heating bills).
*   **Recommendations Engine**: Generates and delivers personalized energy-saving tips to users based on their usage patterns.
*   **External Integrations**: Fetches and processes data from external APIs to enrich the user experience with real-time information.

## Tech Stack

The AURORA Backend is built on the **Firebase** platform, leveraging serverless technologies for scalability and maintainability.

*   **Platform**: [Firebase](https://firebase.google.com/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Runtime**: [Node.js 22](https://nodejs.org/)
*   **Core Services**:
    *   **Cloud Functions**: Serverless compute for event-driven triggers (Firestore, Auth, Pub/Sub) and HTTPS callables.
    *   **Firestore**: NoSQL document database with robust security rules.
    *   **Authentication**: Secure user identity management.
    *   **Storage**: Blob storage for user content and assets.
*   **Testing**: `firebase-functions-test`, `mocha` (implied)

## Installation & Setup

### Prerequisites
*   [Node.js](https://nodejs.org/) (v22 recommended)
*   [npm](https://www.npmjs.com/)
*   [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)

### Getting Started

1.  **Clone the repository**
    ```bash
    git clone https://github.com/AURORA-H2020/AURORA-Firebase.git
    cd AURORA-Firebase
    ```

2.  **Install Dependencies**
    Navigate to the functions directory and install the necessary packages.
    ```bash
    cd functions
    npm install
    ```

3.  **Environment Variables**
    Ensure you have the necessary environment configuration.
    *   Create a `.env` file in `functions/` if required (see `functions/example.env`).

4.  **Run Local Emulators**
    To test the backend locally without affecting production data, use the Firebase Emulator Suite.
    ```bash
    npm run emulator:start
    ```
    This will start emulators for Functions, Firestore, and Pub/Sub.

## Project Structure

The project is organized to separate concerns between different types of cloud functions and security configurations:

*   `functions/src`
    *   `auth`: Trigger functions responding to Authentication events (e.g., user creation/deletion).
    *   `firestore`: Trigger functions responding to Database changes (e.g., calculating emissions on new consumption).
    *   `https`: Callable functions exposed as API endpoints for the client apps.
    *   `pub-sub`: Scheduled tasks (CRON jobs) for background processing (e.g., daily data fetching).
    *   `models`: TypeScript interfaces and data models shared across functions.
    *   `shared-functions`: Reusable utility logic.
*   `security-rules`
    *   `firestore.rules`: Security and validation rules for the Firestore database.
    *   `storage-aurora-dashboard.rules`: Security rules for Firebase Storage.

## The Project Consortium

The AURORA project is a collaboration between nine institutions across six countries:

*   **Technical University of Madrid** (Spain) - Project Coordinator
*   **Aarhus University** (Denmark)
*   **Centre for Sustainable Energy** (United Kingdom)
*   **Forest of Dean District Council** (United Kingdom)
*   **Institute for Science & Innovation Communication** (Germany)
*   **KempleyGreen Consultants** (United Kingdom)
*   **Qualifying Photovoltaics** (Spain)
*   **University of Ljubljana** (Slovenia)
*   **University of Évora** (Portugal)

## License & Funding

This project is part of the AURORA initiative.

<img src="https://www.aurora-h2020.eu/wp-content/uploads/elementor/thumbs/EU-Flag-psu6pdbcnlpmaljtwxkotmokm7piv22d31neeas0vc.png" width="100" align="left" style="margin-right: 20px;" />

**Funded by the European Union.**
This project has received funding from the European Union’s **Horizon 2020** research and innovation programme under grant agreement No **[101036418](https://cordis.europa.eu/project/id/101036418)**.
