![HealthBud Logo](https://raw.githubusercontent.com/Jobbenn/SSW695-A_Fall2025/main/HealthBud/assets/HealthBud.png)

# HealthBud  
**Repository:** [Jobbenn/SSW695-A_Fall2025](https://github.com/Jobbenn/SSW695-A_Fall2025)  
**Course:** SSW 695-A (Fall 2025)  

## Table of Contents
- [Project Overview](#project-overview)  
- [Motivation & Goals](#motivation--goals)  
- [Features](#features)  
- [Architecture & Tech Stack](#architecture--tech-stack)  
- [Getting Started](#getting-started)  
  - [Prerequisites](#prerequisites)  
  - [Installation](#installation)  
  - [Running the App](#running-the-app)  
- [Data Model & API Integration](#data-model--api-integration)  
- [Folder Structure](#folder-structure)  
- [How to Contribute](#how-to-contribute)  
- [Project Status & Roadmap](#project-status--roadmap)  
- [License & Acknowledgements](#license--acknowledgements)  

---

## Project Overview  
HealthBud is a mobile nutrition-tracking application built with React Native and Expo, designed for the SSW 695-A Fall 2025 course. The app enables users to scan barcodes of food items, look up nutrition information (via OpenFoodFacts or other APIs), and track their daily intake. Data is stored and managed using Supabase, and large CSV/Parquet imports feed the food database table.  

---

## Motivation & Goals  
- Leverage your interest in nutrition APIs and data ingestion by integrating OpenFoodFacts (and optionally other sources) to build a comprehensive food database.  
- Practice mobile development with React Native/Expo, camera barcode scanning, and rich UI overlays (e.g., reticle outline, “barcode-outline” button).  
- Use Supabase as a backend (tables like `foods` with `uuid`, `name`, `brand`, `calories`, etc.) and demonstrate capability to import large datasets (CSV/Parquet) via psql or Supabase CLI.  
- Build a polished demo app suitable for portfolio / course grading: intuitive UX, clean architecture, data pipeline, and documented code.

---

## Features  
- Barcode scanning view with reticle overlay for quick food item lookup.  
- Integration with OpenFoodFacts by barcode → fetch nutrition info.  
- Local storage of food items in Supabase: table fields include `uuid`, `name`, `brand`, `calories`, etc.  
- Ability to import large datasets (CSV/Parquet) into Supabase via CLI for bulk food database initialization.  
- Daily intake tracker: users can add items to their log, view totals, and perhaps filter by brand or calories.  
- Clean, responsive UI built with React Native/Expo.

---

## Architecture & Tech Stack  
**Mobile app:** React Native + Expo  
**Backend / Database:** Supabase (PostgreSQL)  
**APIs:** OpenFoodFacts (barcode lookup)  
**Data ingestion tools:** psql CLI or Supabase CLI to import CSV/Parquet datasets  
**UI overlays:** Custom camera view for barcode scanning, reticle overlay, ... 
**State management:** (e.g. Redux, Context API) — adjust if using another method  
**Coding language:** TypeScript

---

## Getting Started  

### Prerequisites  
- Node.js and npm/yarn  
- Expo CLI (`npm install -g expo-cli`)  
- An Android/iOS device or simulator/emulator  

### Installation  
1. Clone this repository:  
   ```bash  
   git clone https://github.com/Jobbenn/SSW695-A_Fall2025.git  
   cd SSW695-A_Fall2025/HealthBud  

    Install dependencies:

yarn install  # or npm install  


Running the App

expo start  

Then open on an iOS/Android simulator or physical device using the Expo Go app.
Use the barcode scanning view to test functionality.

Data Model & API Integration

Supabase foods table (example fields):
Field	Type	Description
uuid	UUID	Primary key
name	Text	Food item name
brand	Text	Brand of the item
calories	Numeric	Calories per serving
barcode	Text	Barcode identifier (UPC/EAN)
…	…	Additional nutrition fields

API workflow:

    User scans barcode → camera view captures code

    App sends barcode to OpenFoodFacts API

    API returns nutrition data → app displays and allows user to save item

    Data inserted into Supabase foods table

    User selects item to add to daily intake log (another table)

Folder Structure

## Repository Structure — Branch: `Goals&OFF`

<details>
<summary><strong>Click to expand folder tree</strong></summary>
SSW695-A_Fall2025/
├── .expo/
│ ├── devices.json
│ └── settings.json
│
├── .vscode/
│ └── settings.json
│
├── Goals&OFF/
│ ├── HealthBud/
│ │ ├── app/
│ │ │ ├── AddFood.tsx
│ │ │ ├── FoodEntry.tsx
│ │ │ ├── HealthBudNavigation.tsx
│ │ │ ├── HomeScreen.tsx
│ │ │ ├── SettingsScreen.tsx
│ │ │ ├── openFoodFacts/
│ │ │ │ ├── lookup.ts
│ │ │ │ ├── nutrition.ts
│ │ │ │ └── search.ts
│ │ ├── assets/
│ │ │ ├── icon.png
│ │ │ ├── splash.png
│ │ │ ├── logo/
│ │ │ │ ├── healthbud-logo-black.png
│ │ │ │ ├── healthbud-logo-white.png
│ │ │ │ └── healthbud-logo-transparent.png
│ │ ├── components/
│ │ │ ├── Buttons/
│ │ │ │ ├── AddButton.tsx
│ │ │ │ └── ScanButton.tsx
│ │ │ ├── Forms/
│ │ │ │ ├── FoodForm.tsx
│ │ │ │ ├── NutritionDisplay.tsx
│ │ │ │ └── TextField.tsx
│ │ │ ├── Layout/
│ │ │ │ ├── Container.tsx
│ │ │ │ └── Header.tsx
│ │ │ └── Reticle/
│ │ │ └── BarcodeReticle.tsx
│ │ ├── sql/
│ │ │ ├── food_import.sql
│ │ │ └── bulk_import_parquet.sql
│ │ ├── utils/
│ │ │ ├── format.ts
│ │ │ ├── psql.ts
│ │ │ └── supabase.ts
│ │ ├── App.tsx
│ │ ├── README.md
│ │ └── tsconfig.json
│ │
│ ├── Academic/
│ │ ├── Goals/
│ │ │ ├── GoalStatement.md
│ │ │ ├── Objectives.md
│ │ │ └── Milelines.md
│ │ ├── OFF/
│ │ │ ├── WeeklyReports/
│ │ │ │ ├── Week1.md
│ │ │ │ ├── Week2.md
│ │ │ │ ├── Week3.md
│ │ │ │ └── Week4.md
│ │ │ ├── MidtermReport.md
│ │ │ └── FinalReport.md
│ │ └── Portfolio/
│ │ ├── Summary.md
│ │ └── Evidence/
│ │ ├── Screenshots/
│ │ │ ├── healthbud-ui-1.png
│ │ │ ├── healthbud-ui-2.png
│ │ │ └── healthbud-ui-3.png
│ │ └── Diagrams/
│ │ ├── architecture.png
│ │ └── data-pipeline.png
│ │
│ └── README.md
│
├── .gitignore
├── package.json
└── README.md
<br>
</details>
