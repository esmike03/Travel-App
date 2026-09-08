# Travs Admin Portal

Laravel + React + Inertia + Tailwind scaffold for the Travs administration portal.

## Modules

- Dashboard analytics
- User, role, and permission management
- Destination, category, municipality, and image management
- Review moderation
- Announcement management
- Automated destination import and approval workflow
- Import history
- Sync management
- Reports and statistics

## Local Setup

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm run dev
php artisan serve
```

## Import Workflow

Automated destination collection should run as queued jobs. New findings are written into `imported_destinations` with `pending` status. Admins approve, reject, or merge records before the public API exposes them to the Android app.
