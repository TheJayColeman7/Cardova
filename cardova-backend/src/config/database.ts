import pg from "pg";
import { getDatabaseConfig } from "./env.js";

const { Pool, types } = pg;

const DATE_OID = 1082;
const INT8_OID = 20;

types.setTypeParser(DATE_OID, (value) => value);
types.setTypeParser(INT8_OID, (value) => Number.parseInt(value, 10));

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const config = getDatabaseConfig();
    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.name,
      user: config.user,
      // pg's config parser treats "" as missing; a function always provides the value.
      password: async () => config.password,
      ssl: false,
      connectionTimeoutMillis: 10_000,
    });
  }

  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}
