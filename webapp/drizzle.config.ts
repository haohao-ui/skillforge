import { defineConfig } from "drizzle-kit";
import { detectDatabaseDialect } from "./drizzle/dialect";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

function validateDatabaseUrl(databaseUrl: string) {
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
      : "./drizzle/mysqlSchema.ts",
  out: dialect === "postgresql" ? "./drizzle/postgres" : "./drizzle",
  dialect,
  dbCredentials: {
    url: connectionString,
  },
});
