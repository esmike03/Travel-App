# Database Schema

The admin backend uses MySQL. The Android app mirrors a subset of these records in SQLite.

## Core Tables

- `users`
- `roles`
- `role_user`
- `categories`
- `municipalities`
- `destinations`
- `destination_images`
- `destination_amenities`
- `destination_nearby`
- `reviews`
- `favorites`
- `itineraries`
- `itinerary_items`
- `announcements`
- `import_batches`
- `imported_destinations`
- `source_records`
- `sync_events`

## Destination Fields

- `id`
- `name`
- `slug`
- `description`
- `category_id`
- `municipality_id`
- `address`
- `latitude`
- `longitude`
- `entrance_fee`
- `opening_hours`
- `contact_phone`
- `contact_email`
- `website_url`
- `best_time_to_visit`
- `facilities`
- `average_rating`
- `review_count`
- `status`
- `published_at`
- `created_at`
- `updated_at`

## Imported Destination Fields

- `id`
- `import_batch_id`
- `source_url`
- `source_name`
- `raw_payload`
- `normalized_payload`
- `duplicate_destination_id`
- `confidence_score`
- `ai_summary`
- `ai_category`
- `status`
- `reviewed_by`
- `reviewed_at`
- `created_at`
- `updated_at`

## SQLite Mobile Mirror

The mobile database stores:

- Published destinations and related metadata
- Images for cache lookup
- Categories and municipalities
- User favorites
- Itinerary items
- Pending reviews and other unsynced mutations
- Sync cursor metadata

Remote IDs are retained so records can be reconciled during sync.
