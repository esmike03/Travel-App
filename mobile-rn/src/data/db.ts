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
          position INTEGER NOT NULL DEFAULT 0
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
       (id, destinationId, date, hour, minute, notes, visited, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.destinationId,
      row.date,
      row.hour,
      row.minute,
      row.notes,
      row.visited,
      row.position,
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
