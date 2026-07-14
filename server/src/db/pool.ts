import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "..", "..", "gateway.db");

// node:sqlite is a Node built-in (stable from Node 22.5+, still marked
// experimental) — chosen over better-sqlite3 to avoid native-module
// compilation (node-gyp/Visual Studio) on the dev machine.
export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");

export function runMigrations(): void {
  const schema = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
}

// Run eagerly at import time: queries.ts prepares statements against these
// tables at its own module-load time, which (in ESM) happens before any
// code in index.ts runs — including an explicit runMigrations() call there.
runMigrations();
