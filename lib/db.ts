import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "bookings.db");

let db = null;
try {
  // require dynamically so missing native module won't crash during import
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require("better-sqlite3");
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      vehicleId TEXT,
      model TEXT,
      plate TEXT,
      name TEXT,
      email TEXT,
      startOn TEXT,
      endOn TEXT,
      createdAt TEXT
    );
  `);
} catch (err) {
  // better-sqlite3 not available or init failed — fall back to null
  // console.warn should be safe in server logs
  // eslint-disable-next-line no-console
  console.warn("better-sqlite3 not available — bookings will use file fallback if implemented.");
  db = null;
}

export default db;
