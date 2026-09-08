# Automated Destination Import Pipeline

## Goals

- Reduce manual destination encoding.
- Keep admin control over what gets published.
- Preserve source attribution and quality signals.
- Avoid duplicate destinations.

## Pipeline Stages

1. Source discovery
2. Crawl queue creation
3. HTML fetching and extraction
4. Entity normalization
5. AI enrichment
6. Duplicate detection
7. Admin review
8. Publishing and periodic refresh

## Trusted Source Strategy

Start with a curated allowlist managed in the admin portal:

- Official tourism pages
- Public tourism directories
- Municipality pages
- Travel blogs with visible attribution
- Public map/business listing pages where terms permit collection

The crawler should obey robots.txt, rate limits, and source terms.

## AI Enrichment

AI is used to:

- Summarize long descriptions
- Assign a category
- Extract likely amenities and facilities
- Normalize opening hours and fee descriptions
- Flag low-confidence or conflicting information

AI should not auto-publish. It writes suggestions into `imported_destinations.normalized_payload` for admin review.

## Duplicate Detection

Use a weighted score:

- Normalized name similarity
- Distance between coordinates
- Same municipality
- Address similarity
- Source URL history
- Image similarity later, if needed

Records above a high confidence threshold should be suggested as merges. Mid-confidence matches should be sent for manual review.

## Refresh Checks

Scheduled jobs revisit approved sources and compare:

- Description changes
- New images
- Updated hours
- Updated fees
- Ratings and review summary changes

Admins approve meaningful changes before they affect mobile users.
