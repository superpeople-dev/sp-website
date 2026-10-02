import { attachDatabasePool } from "@vercel/functions";
import pg from "pg";

// The site's own data, in Postgres on Neon (the SuperPeople project): bans, admins, downvotes,
// notifications, API keys, download limits and the like (lib/store.ts, lib/downloads.ts,
// lib/consentstore.ts, lib/ipv4.ts). DATABASE_URL is the pooled address, as Neon advises for
// serverless functions; schema changes go through scripts/db-migrate.mjs on the direct one.

// bigint columns (epoch milliseconds, byte counts) come back as numbers: they stay far below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

// Neon's addresses say sslmode=require, which pg already treats as verify-full (the certificate and
// the host are checked); asked for by name, it stays so in pg 9 and pg stops warning about it.
const verifiedSsl = (address: string) => address.replace(/([?&]sslmode=)(?:prefer|require|verify-ca)\b/, "$1verify-full");

const url = process.env.DATABASE_URL && verifiedSsl(process.env.DATABASE_URL);

// One pool per function instance (and one in dev, across reloads). attachDatabasePool keeps the
// instance alive long enough to close idle connections cleanly (Vercel Fluid compute).
const shared = globalThis as typeof globalThis & { spPool?: pg.Pool };
function makePool() {
  const pool = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 10_000 });
  pool.on("error", (error) => console.error(`[db] idle connection failed: ${error.message}`));
  attachDatabasePool(pool);
  return pool;
}
const pool = url ? (shared.spPool ??= makePool()) : null;

export const dbReady = pool !== null;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  if (!pool) throw new Error("Database is not configured");
  return (await pool.query<T>(text, values)).rows;
}

// Old short-lived values and hourly counts are deleted now and then, by whichever write comes along.
const sweepEvery = 200;
function sweepSometimes() {
  if (Math.random() * sweepEvery >= 1) return;
  const hour = Math.floor(Date.now() / 3_600_000);
  void Promise.all([
    query("delete from expiring where expires_at < now()"),
    query("delete from hourly where hour < $1", [hour - 3]),
  ]).catch((error) => console.error(`[db] sweep failed: ${error instanceof Error ? error.message : String(error)}`));
}

// A value kept for `seconds` (what Redis did with an expiry).
export async function setExpiring(key: string, value: unknown, seconds: number) {
  sweepSometimes();
  await query(
    `insert into expiring (key, value, expires_at) values ($1, $2, now() + make_interval(secs => $3))
     on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at`,
    [key, JSON.stringify(value), seconds],
  );
}

export async function getExpiring<T>(key: string): Promise<T | null> {
  const [row] = await query<{ value: T }>("select value from expiring where key = $1 and expires_at > now()", [key]);
  return row ? row.value : null;
}

// Reads it and deletes it, once (a sign-in code).
export async function takeExpiring<T>(key: string): Promise<T | null> {
  const [row] = await query<{ value: T; live: boolean }>(
    "delete from expiring where key = $1 returning value, expires_at > now() as live",
    [key],
  );
  return row?.live ? row.value : null;
}

// Adds `amount` to `key`'s count for `hour` and returns the new count.
export async function addHourly(key: string, hour: number, amount: number) {
  sweepSometimes();
  const [row] = await query<{ amount: number }>(
    `insert into hourly (key, hour, amount) values ($1, $2, $3)
     on conflict (key, hour) do update set amount = hourly.amount + excluded.amount
     returning amount`,
    [key, hour, amount],
  );
  return row.amount;
}
