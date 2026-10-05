import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

export function createAlertRepository(databasePath) {
  const absolutePath = resolve(databasePath);
  mkdirSync(dirname(absolutePath), { recursive: true });

  const database = new Database(absolutePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
  `);

  const insertAlert = database.prepare(`
    INSERT INTO alerts (device_id, occurred_at, received_at, payload_json)
    VALUES (@device_id, @occurred_at, @received_at, @payload_json)
  `);

  return {
    save(alert, receivedAt) {
      const result = insertAlert.run({
        device_id: alert.device_id,
        occurred_at: alert.timestamp,
        received_at: receivedAt,
        payload_json: JSON.stringify(alert),
      });

      return Number(result.lastInsertRowid);
    },

    close() {
      database.close();
    },
  };
}
