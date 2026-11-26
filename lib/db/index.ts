/**
 * FILE GUIDE
 * Opens the Postgres connection (Drizzle ORM). Everything that reads or writes data imports `db` from here.
 * Connection string comes from DATABASE_URL in .env.local.
 */
import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalForDb.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
