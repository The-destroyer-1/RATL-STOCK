// Vercel serverless functions do not provide a writable, persistent local SQLite
// filesystem. Booking storage currently uses the JSON fallback in lib/bookings.ts;
// replace this with a hosted database before relying on bookings in production.
const db = null;

export default db;
