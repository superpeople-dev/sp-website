// Applies db/migrations/*.sql to the database, in name order, each once and in a transaction of its
// own. Uses the direct (unpooled) connection, as schema changes need. `bun run db:migrate` reads
// .env.local; on Neon a branch's DATABASE_URL_UNPOOLED is the one to give it.
//
//   bun run db:migrate            apply what is missing
//   bun run db:migrate --status   list what is applied and what is not
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set");
  process.exit(1);
}
const folder = join(import.meta.dirname, "..", "db", "migrations");
const files = readdirSync(folder).filter((name) => /^\d{3}_[\w-]+\.sql$/.test(name)).sort();

// sslmode=require, as Neon gives it, is verify-full in pg: said by name (see src/lib/db.ts).
const client = new pg.Client({ connectionString: url.replace(/([?&]sslmode=)(?:prefer|require|verify-ca)\b/, "$1verify-full") });
await client.connect();
try {
  await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const applied = new Set((await client.query("select name from schema_migrations")).rows.map((row) => row.name));
  const host = new URL(url).hostname.split(".")[0];
  if (process.argv.includes("--status")) {
    for (const name of files) console.log(`${applied.has(name) ? "applied" : "missing"}  ${name}`);
  } else {
    const missing = files.filter((name) => !applied.has(name));
    if (!missing.length) console.log(`${host}: up to date (${files.length} migrations)`);
    for (const name of missing) {
      await client.query("begin");
      try {
        await client.query(readFileSync(join(folder, name), "utf8"));
        await client.query("insert into schema_migrations (name) values ($1)", [name]);
        await client.query("commit");
        console.log(`${host}: applied ${name}`);
      } catch (error) {
        await client.query("rollback");
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
} finally {
  await client.end();
}
