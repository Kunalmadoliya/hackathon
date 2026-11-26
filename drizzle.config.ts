/**
 * FILE GUIDE
 * Tells drizzle-kit where the tables are defined (lib/db/schema.ts) and which database to update.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://platter:platter@localhost:5433/platter",
  },
});
