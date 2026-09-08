// SQLite persistence (expo-sqlite) — mirrors the original app's Room database.
// Backs the trip itinerary so stops, order and visited state survive restarts.
import * as SQLite from 'expo-sqlite';

export interface TripStopRow {
  id: number;
  destinationId: number;
  date: string;
  hour: number;
  minute: number;
  notes: string | null;
  visited: number; // 0 | 1 (SQLite has no boolean)
  position: number; // manual drag order
  scope: string; // 'day' | 'week' | 'month' — the plan the user created it under
  // The plan's date range. Null on rows written before ranges existed; the
  // caller backfills those from scope + date (see defaultRange).
  planStart: string | null;
  planEnd: string | null;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('travs.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS trip_stops (
          id INTEGER PRIMARY KEY,
          destinationId INTEGER NOT NULL,
          date TEXT NOT NULL,
          hour INTEGER NOT NULL,
          minute INTEGER NOT NULL,
          notes TEXT,
          visited INTEGER NOT NULL DEFAULT 0,
          position INTEGER NOT NULL DEFAULT 0,
          scope TEXT NOT NULL DEFAULT 'day',
          planStart TEXT,
          planEnd TEXT
        );
        CREATE TABLE IF NOT EXISTS favorites (
          destinationId INTEGER PRIMARY KEY
        );
        CREATE TABLE IF NOT EXISTS plans (
          planKey TEXT PRIMARY KEY,
          targetBudget REAL,
          notes TEXT,
          items TEXT,
          title TEXT,
          origin TEXT,
          departureAt TEXT,
          destinationName TEXT,
          travelerCount INTEGER NOT NULL DEFAULT 2,
          travelerNames TEXT
        );
        -- Single-row cache (id = 1) of the last weather fetch, so the forecast
        -- still shows on the road with no signal instead of an empty card.
        CREATE TABLE IF NOT EXISTS weather_cache (
          id INTEGER PRIMARY KEY,
          fetchedAt INTEGER NOT NULL,
          payload TEXT NOT NULL
        );
        -- Small key/value store for app settings (currently the region the app
        -- is pointed at). Kept here so settings survive with the trip data.
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        -- Places the traveller searched for and added themselves. Trip stops
        -- reference these by id exactly as they do curated destinations, so a
        -- row must outlive the search that found it.
        CREATE TABLE IF NOT EXISTS custom_places (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          municipality TEXT NOT NULL,
          location TEXT NOT NULL,
          category TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          sourceUrl TEXT
        );
        -- Permanent on-device check-in history. It is intentionally separate
        -- from trip_stops so removing an itinerary item does not erase a visit.
        CREATE TABLE IF NOT EXISTS visit_history (
          visitKey TEXT PRIMARY KEY,
          destinationId INTEGER NOT NULL,
          visitedAt INTEGER NOT NULL,
          visitDate TEXT NOT NULL,
          planKey TEXT NOT NULL
        );
      `);
      // Migration for databases created before `position` existed.
      try {
        await db.execAsync(
          'ALTER TABLE trip_stops ADD COLUMN position INTEGER NOT NULL DEFAULT 0'
        );
      } catch {
        // Column already exists — ignore.
      }
      // Migration for databases created before `scope` existed (defaults to a
      // per-day plan, matching the old behaviour).
      try {
        await db.execAsync(
          "ALTER TABLE trip_stops ADD COLUMN scope TEXT NOT NULL DEFAULT 'day'"
        );
      } catch {
        // Column already exists — ignore.
      }
      // Migration for databases created before week plans could span a custom
      // date range. Left null and backfilled on load from scope + date, which
      // reproduces the old fixed day/Mon–Sun/calendar-month behaviour exactly.
      for (const col of ['planStart', 'planEnd']) {
        try {
          await db.execAsync(`ALTER TABLE trip_stops ADD COLUMN ${col} TEXT`);
        } catch {
          // Column already exists — ignore.
        }
      }
      // Plan identity and journey details were added after budgets/notes. Keep
      // the migration additive so every existing local trip remains intact.
      for (const statement of [
        'ALTER TABLE plans ADD COLUMN title TEXT',
        'ALTER TABLE plans ADD COLUMN origin TEXT',
        'ALTER TABLE plans ADD COLUMN departureAt TEXT',
        'ALTER TABLE plans ADD COLUMN destinationName TEXT',
        'ALTER TABLE plans ADD COLUMN travelerCount INTEGER NOT NULL DEFAULT 2',
        // JSON string[]; null on rows written before people could be named, and
        // backfilled from travelerCount on load.
        'ALTER TABLE plans ADD COLUMN travelerNames TEXT',
      ]) {
        try {
          await db.execAsync(statement);
        } catch {
          // Column already exists — ignore.
        }
      }
      return db;
    });
  }
  return dbPromise;
}

export async function loadTripStops(): Promise<TripStopRow[]> {
  const db = await getDb();
  return db.getAllAsync<TripStopRow>('SELECT * FROM trip_stops ORDER BY position, id');
}

export async function upsertTripStop(row: TripStopRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO trip_stops
       (id, destinationId, date, hour, minute, notes, visited, position, scope, planStart, planEnd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.destinationId,
      row.date,
      row.hour,
      row.minute,
      row.notes,
      row.visited,
      row.position,
      row.scope,
      row.planStart,
      row.planEnd,
    ]
  );
}

export async function deleteTripStop(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM trip_stops WHERE id = ?', [id]);
}

export async function deleteTripStopsByDestination(destinationId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM trip_stops WHERE destinationId = ?', [destinationId]);
}

export async function setTripStopVisited(id: number, visited: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE trip_stops SET visited = ? WHERE id = ?', [visited ? 1 : 0, id]);
}

// Rewrite the manual order for all stops (position = array index).
export async function persistPositions(idsInOrder: number[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < idsInOrder.length; i += 1) {
      await db.runAsync('UPDATE trip_stops SET position = ? WHERE id = ?', [i, idsInOrder[i]]);
    }
  });
}

/* ---------------- Explored-place history ---------------- */

export interface VisitHistoryRow {
  visitKey: string;
  destinationId: number;
  visitedAt: number;
  visitDate: string;
  planKey: string;
}

export async function loadVisitHistory(): Promise<VisitHistoryRow[]> {
  const db = await getDb();
  return db.getAllAsync<VisitHistoryRow>(
    'SELECT * FROM visit_history ORDER BY visitedAt DESC'
  );
}

export async function recordVisit(row: VisitHistoryRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO visit_history
       (visitKey, destinationId, visitedAt, visitDate, planKey)
     VALUES (?, ?, ?, ?, ?)`,
    [row.visitKey, row.destinationId, row.visitedAt, row.visitDate, row.planKey]
  );
}

/* ---------------- Favorites ---------------- */

export async function loadFavorites(): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ destinationId: number }>(
    'SELECT destinationId FROM favorites'
  );
  return rows.map((r) => r.destinationId);
}

export async function addFavorite(destinationId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO favorites (destinationId) VALUES (?)',
    [destinationId]
  );
}

export async function removeFavorite(destinationId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM favorites WHERE destinationId = ?', [destinationId]);
}

/* ---------------- Plan metadata (budget / notes) ---------------- */

export interface PlanMetaRow {
  planKey: string;
  targetBudget: number | null;
  notes: string | null;
  items: string | null; // JSON-encoded BudgetItem[]
  title: string | null;
  origin: string | null;
  departureAt: string | null;
  destinationName: string | null;
  travelerCount: number | null;
  travelerNames: string | null; // JSON-encoded string[]
}

export async function loadPlanMetas(): Promise<PlanMetaRow[]> {
  const db = await getDb();
  return db.getAllAsync<PlanMetaRow>('SELECT * FROM plans');
}

export async function upsertPlanMeta(row: PlanMetaRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO plans
       (planKey, targetBudget, notes, items, title, origin, departureAt, destinationName, travelerCount, travelerNames)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.planKey,
      row.targetBudget,
      row.notes,
      row.items,
      row.title,
      row.origin,
      row.departureAt,
      row.destinationName,
      row.travelerCount,
      row.travelerNames,
    ]
  );
}

/* ---------------- Custom places ---------------- */

export interface CustomPlaceRow {
  id: number;
  name: string;
  municipality: string;
  location: string;
  category: string;
  latitude: number;
  longitude: number;
  sourceUrl: string | null;
}

export async function loadCustomPlaces(): Promise<CustomPlaceRow[]> {
  const db = await getDb();
  return db.getAllAsync<CustomPlaceRow>('SELECT * FROM custom_places ORDER BY id');
}

export async function upsertCustomPlace(row: CustomPlaceRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO custom_places
       (id, name, municipality, location, category, latitude, longitude, sourceUrl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.name,
      row.municipality,
      row.location,
      row.category,
      row.latitude,
      row.longitude,
      row.sourceUrl,
    ]
  );
}

/* ---------------- Settings (key/value) ---------------- */

export async function loadSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

/* ---------------- Weather cache ---------------- */

export interface WeatherCacheRow {
  fetchedAt: number; // epoch ms
  payload: string; // JSON-encoded WeatherByDestination
}

export async function loadWeatherCache(): Promise<WeatherCacheRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<WeatherCacheRow>(
    'SELECT fetchedAt, payload FROM weather_cache WHERE id = 1'
  );
  return row ?? null;
}

export async function saveWeatherCache(row: WeatherCacheRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO weather_cache (id, fetchedAt, payload) VALUES (1, ?, ?)',
    [row.fetchedAt, row.payload]
  );
}
