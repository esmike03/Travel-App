# API Contract

Base path: `/api/v1`

Authentication: bearer token for mobile clients.

## Mobile Endpoints

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /me`
- `PATCH /me`

### Catalog

- `GET /destinations`
- `GET /destinations/{destination}`
- `GET /categories`
- `GET /municipalities`
- `GET /announcements`

Useful destination query parameters:

- `q`
- `category_id`
- `municipality_id`
- `near`
- `radius_km`
- `updated_after`
- `page`

### User Actions

- `GET /favorites`
- `POST /favorites`
- `DELETE /favorites/{destination}`
- `GET /itineraries`
- `POST /itineraries`
- `PATCH /itineraries/{itinerary}`
- `DELETE /itineraries/{itinerary}`
- `POST /reviews`

### Sync

- `GET /sync/pull?cursor=...`
- `POST /sync/push`
- `POST /sync/device`

## Admin Endpoints

Admin pages are primarily Inertia routes. JSON endpoints support background operations:

- `POST /admin/imports/run`
- `GET /admin/imports/{importBatch}`
- `POST /admin/imports/{importedDestination}/approve`
- `POST /admin/imports/{importedDestination}/reject`
- `POST /admin/imports/{importedDestination}/merge`
- `POST /admin/destinations/{destination}/publish`
- `POST /admin/reviews/{review}/moderate`

## Destination Payload

```json
{
  "id": 1,
  "name": "Chocolate Hills",
  "slug": "chocolate-hills",
  "description": "A natural landmark in Bohol known for its cone-shaped hills.",
  "category": {
    "id": 1,
    "name": "Nature"
  },
  "municipality": {
    "id": 1,
    "name": "Carmen"
  },
  "latitude": 9.8297,
  "longitude": 124.1397,
  "address": "Carmen, Bohol, Philippines",
  "entrance_fee": null,
  "opening_hours": null,
  "contact": null,
  "best_time_to_visit": null,
  "amenities": ["View deck", "Parking"],
  "average_rating": 4.7,
  "review_count": 128,
  "images": [
    {
      "id": 1,
      "url": "https://example.com/images/chocolate-hills.jpg",
      "caption": "Chocolate Hills viewpoint",
      "position": 1
    }
  ],
  "nearby_destination_ids": [2, 3],
  "updated_at": "2026-07-12T00:00:00Z"
}
```

## Sync Push Payload

```json
{
  "client_mutation_id": "uuid",
  "favorites": [],
  "reviews": [],
  "itinerary_items": [],
  "profile": null
}
```
