import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { closePool, getPool } from "../config/database.js";
import { backendRoot } from "../config/env.js";

const MIGRATIONS_DIR = join(backendRoot, "database", "migrations");

async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const pool = getPool();
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM schema_migrations ORDER BY id ASC"
  );
  return new Set(result.rows.map((row) => row.id));
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

async function applyMigration(filename: string): Promise<void> {
  const pool = getPool();
  const sql = await readFile(join(MIGRATIONS_DIR, filename), "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [filename]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function migrate(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = await listMigrationFiles();
  const pending = files.filter((filename) => !applied.has(filename));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  for (const filename of pending) {
    console.log(`Applying ${filename}...`);
    await applyMigration(filename);
    console.log(`Applied ${filename}`);
  }

  console.log(`Migrations complete (${pending.length} applied).`);
}

try {
  await migrate();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("password must be a")) {
    console.error(
      "Migration failed: PostgreSQL requires a non-empty DATABASE_PASSWORD in .env."
    );
  } else {
    console.error("Migration failed:", message);
  }
  process.exitCode = 1;
} finally {
  await closePool();
  process.exit(process.exitCode ?? 0);
}
