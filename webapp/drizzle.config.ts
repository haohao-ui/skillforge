import { defineConfig } from "drizzle-kit";
import { detectDatabaseDialect } from "./drizzle/dialect";

const DEFAULT_DATABASE_URL = "file:.data/skillforge.sqlite";
const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

function validateDatabaseUrl(databaseUrl: string) {
  if (databaseUrl.startsWith("file:") || databaseUrl.startsWith("sqlite:")) {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  if (!parsed.hostname) {
    throw new Error("DATABASE_URL must include a database host");
  }

  if (parsed.hostname === "host") {
    throw new Error(
      'DATABASE_URL is still using the placeholder host "host". Update .env with your real PostgreSQL/MySQL hostname before running drizzle commands.'
    );
  }
}

validateDatabaseUrl(connectionString);

const dialect = detectDatabaseDialect(connectionString);

export default defineConfig({
  schema:
    dialect === "postgresql"
      ? "./drizzle/pgSchema.ts"
      : dialect === "sqlite"
        ? "./drizzle/sqliteSchema.ts"
        : "./drizzle/mysqlSchema.ts",
  out:
    dialect === "postgresql"
      ? "./drizzle/postgres"
      : dialect === "sqlite"
        ? "./drizzle/sqlite"
        : "./drizzle",
  dialect,
  dbCredentials: {
    url: connectionString,
  },
});
