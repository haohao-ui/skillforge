export type DatabaseDialect = "mysql" | "postgresql" | "sqlite";

const MYSQL_PROTOCOLS = new Set(["mysql", "mariadb", "tidb"]);
const POSTGRES_PROTOCOLS = new Set(["postgres", "postgresql"]);
const SQLITE_PROTOCOLS = new Set(["file", "sqlite"]);

export function detectDatabaseDialect(databaseUrl: string): DatabaseDialect {
  const protocol = databaseUrl.match(/^([a-z0-9+.-]+):/i)?.[1]?.toLowerCase();
  if (!protocol) {
    throw new Error(
      "DATABASE_URL must include a protocol such as mysql:// or postgres://"
    );
  }
  if (MYSQL_PROTOCOLS.has(protocol)) {
    return "mysql";
  }
  if (POSTGRES_PROTOCOLS.has(protocol)) {
    return "postgresql";
  }
  if (SQLITE_PROTOCOLS.has(protocol)) {
    return "sqlite";
  }
  throw new Error(
    `Unsupported database protocol "${protocol}" in DATABASE_URL`
  );
}
