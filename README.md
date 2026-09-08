# Travs - Bohol Travel Companion

Travs is a full-stack tourism platform for Bohol, Philippines. It includes:

- Android mobile app for tourists, built with Material Design 3, Jetpack Compose, MVVM, SQLite-first offline storage, maps, geofencing, itinerary planning, reviews, and sync.
- Laravel + React + Inertia admin portal for managing destinations, users, reviews, announcements, imports, analytics, and sync operations.
- AI-assisted destination import pipeline for discovering, deduplicating, summarizing, categorizing, and approving tourist destinations before publishing.

## Repository Layout

```text
admin/    Laravel, React, Inertia, Tailwind admin portal scaffold
docs/     Architecture, API, database, and import pipeline references
mobile/   Android Studio project scaffold for the tourist app
shared/   Cross-platform contracts and seed/reference data
```

## Important Build Note

The Android requirements mention both Java and Jetpack Compose. Jetpack Compose production UI is Kotlin-based, so the mobile scaffold uses Kotlin for UI, ViewModels, and data layers while keeping the architecture Java-interoperable. If a strict Java-only client is required later, the UI stack should switch from Compose to XML views.

## Core Product Modules

- Authentication and profiles
- Destination discovery, search, filters, categories, and municipalities
- Destination detail pages with gallery, map, reviews, travel estimates, fees, hours, contact, amenities, and nearby attractions
- Favorites and itinerary planning
- Offline SQLite cache with background synchronization
- OpenStreetMap-compatible map and routing integration
- GPS geofencing and travel reminders
- Admin review workflow for automated destination imports
- Role-based admin permissions

## Getting Started

Open `mobile/` in Android Studio for the Android app.

Open `admin/` as a Laravel project once dependencies are installed:

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm run dev
php artisan serve
```

The scaffold is designed as a foundation. It defines the architecture, database model, API contracts, Android screens, repositories, and Laravel domain services needed to continue toward a complete implementation.
