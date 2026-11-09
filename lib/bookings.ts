import db from "@/lib/db";
import fs from "fs";
import path from "path";

export type Booking = {
  id: string;
  vehicleId: string;
  model: string;
  plate: string;
  name: string;
  email: string;
  startOn: string; // ISO date
  endOn: string; // ISO date
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "bookings.json");

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, JSON.stringify([]), "utf8");
  } catch (err) {
    // ignore
  }
}

function readStore(): Booking[] {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    return [];
  }
}

function writeStore(bookings: Booking[]) {
  try {
    ensureDataFile();
    fs.writeFileSync(FILE_PATH, JSON.stringify(bookings, null, 2), "utf8");
  } catch (err) {
    // ignore
  }
}

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

let createBooking: (payload: Omit<Booking, "id" | "createdAt">) => Booking;
let listBookings: () => Booking[];
let getBookingsForVehicle: (vehicleId: string) => Booking[];
let deleteBooking: (id: string) => Booking | null;
let isVehicleBookedInRange: (vehicleId: string, startOn: string, endOn: string) => boolean;
let isVehicleBookedNow: (vehicleId: string) => boolean;

if (db) {
  createBooking = (payload) => {
    const id = createId();
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO bookings (id, vehicleId, model, plate, name, email, startOn, endOn, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(id, payload.vehicleId, payload.model, payload.plate, payload.name, payload.email, payload.startOn, payload.endOn, createdAt);
    return { id, createdAt, ...payload } as Booking;
  };

  listBookings = () => {
    const stmt = db.prepare(`SELECT * FROM bookings ORDER BY createdAt DESC`);
    return stmt.all() as Booking[];
  };

  getBookingsForVehicle = (vehicleId) => {
    const stmt = db.prepare(`SELECT * FROM bookings WHERE vehicleId = ? ORDER BY startOn`);
    return stmt.all(vehicleId) as Booking[];
  };

  deleteBooking = (id) => {
    const find = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(id);
    if (!find) return null;
    db.prepare(`DELETE FROM bookings WHERE id = ?`).run(id);
    return find as Booking;
  };

  isVehicleBookedInRange = (vehicleId, startOn, endOn) => {
    const stmt = db.prepare(`SELECT COUNT(1) as c FROM bookings WHERE vehicleId = ? AND NOT (endOn < ? OR startOn > ?)`);
    const row = stmt.get(vehicleId, startOn, endOn) as { c: number };
    return row.c > 0;
  };

  isVehicleBookedNow = (vehicleId) => {
    const stmt = db.prepare(`SELECT COUNT(1) as c FROM bookings WHERE vehicleId = ? AND startOn <= ? AND endOn >= ?`);
    const row = stmt.get(vehicleId, new Date().toISOString(), new Date().toISOString()) as { c: number };
    return row.c > 0;
  };
} else {
  createBooking = (payload) => {
    const bookings = readStore();
    const booking: Booking = { ...payload, id: createId(), createdAt: new Date().toISOString() };
    bookings.push(booking);
    writeStore(bookings);
    return booking;
  };

  listBookings = () => readStore();

  getBookingsForVehicle = (vehicleId) => readStore().filter((b) => b.vehicleId === vehicleId);

  deleteBooking = (id) => {
    const bookings = readStore();
    const idx = bookings.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    const [removed] = bookings.splice(idx, 1);
    writeStore(bookings);
    return removed;
  };

  isVehicleBookedInRange = (vehicleId, startOn, endOn) => {
    const s = new Date(startOn);
    const e = new Date(endOn);
    return readStore().some((b) => b.vehicleId === vehicleId && !(new Date(b.endOn) < s || new Date(b.startOn) > e));
  };

  isVehicleBookedNow = (vehicleId) => {
    const now = new Date();
    return readStore().some((b) => new Date(b.startOn) <= now && new Date(b.endOn) >= now && b.vehicleId === vehicleId);
  };
}

export { createBooking, listBookings, getBookingsForVehicle, deleteBooking, isVehicleBookedInRange, isVehicleBookedNow };
