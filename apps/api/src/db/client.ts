import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for ProxyKey API");
  }

  pool ??= new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return drizzle(pool, { schema });
}

export async function closeDb() {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}

export type ProxyKeyDb = ReturnType<typeof createDb>;
