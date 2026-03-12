import { and, desc, eq } from "drizzle-orm";
import { drizzle as drizzleMySql } from "drizzle-orm/mysql2";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { ENV } from "./_core/env";
import {
  detectDatabaseDialect,
  type DatabaseDialect,
} from "../drizzle/dialect";
import type {
  GenerationResult,
  GenerationStep,
  InsertGenerationStep,
  InsertSkillGeneration,
  InsertUser,
  SkillGeneration,
  User,
} from "../drizzle/schema";
import * as mysqlSchema from "../drizzle/mysqlSchema";
import * as pgSchema from "../drizzle/pgSchema";
import * as sqliteSchema from "../drizzle/sqliteSchema";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
type SqliteDatabaseSync = import("node:sqlite").DatabaseSync;

type DatabaseTables = {
  users: any;
  skillGenerations: any;
  generationSteps: any;
};

type DatabaseHandle = {
  db: any;
  dialect: DatabaseDialect;
  tables: DatabaseTables;
};

const DEFAULT_DATABASE_URL = "file:.data/skillforge.sqlite";

const MYSQL_TABLES: DatabaseTables = {
  users: mysqlSchema.users,
  skillGenerations: mysqlSchema.skillGenerations,
  generationSteps: mysqlSchema.generationSteps,
};

const POSTGRES_TABLES: DatabaseTables = {
  users: pgSchema.users,
  skillGenerations: pgSchema.skillGenerations,
  generationSteps: pgSchema.generationSteps,
};

const SQLITE_TABLES: DatabaseTables = {
  users: sqliteSchema.users,
  skillGenerations: sqliteSchema.skillGenerations,
  generationSteps: sqliteSchema.generationSteps,
};

const SQLITE_GENERATION_COLUMNS = new Set([
  "userId",
  "skillName",
  "domain",
  "features",
  "scenarios",
  "extraNotes",
  "llmApiUrl",
  "llmApiKey",
  "llmModel",
  "llmMaxTokens",
  "status",
  "currentStep",
  "result",
  "errorMessage",
  "createdAt",
  "updatedAt",
  "completedAt",
]);

const SQLITE_STEP_COLUMNS = new Set([
  "generationId",
  "stepNumber",
  "stepName",
  "status",
  "output",
  "summary",
  "errorMessage",
  "startedAt",
  "completedAt",
  "createdAt",
]);

let databaseHandle: DatabaseHandle | null = null;
let cachedDatabaseUrl: string | null = null;

function resolveDatabaseUrl() {
  const configured = (process.env.DATABASE_URL ?? ENV.databaseUrl ?? "").trim();
  return configured || DEFAULT_DATABASE_URL;
}

function resolveSqliteFilePath(databaseUrl: string) {
  if (databaseUrl === ":memory:" || databaseUrl === "file::memory:") {
    return ":memory:";
  }

  if (databaseUrl.startsWith("file:")) {
    return path.resolve(process.cwd(), databaseUrl.slice("file:".length));
  }

  if (databaseUrl.startsWith("sqlite:")) {
    return path.resolve(process.cwd(), databaseUrl.slice("sqlite:".length));
  }

  return path.resolve(process.cwd(), databaseUrl);
}

function ensureSqliteDirectory(filePath: string) {
  if (filePath === ":memory:") return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function bootstrapSqliteDatabase(db: SqliteDatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      loginMethod TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastSignedIn TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS skill_generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      skillName TEXT NOT NULL,
      domain TEXT NOT NULL,
      features TEXT NOT NULL,
      scenarios TEXT,
      extraNotes TEXT,
      llmApiUrl TEXT,
      llmApiKey TEXT,
      llmModel TEXT,
      llmMaxTokens INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      currentStep INTEGER NOT NULL DEFAULT 0,
      result TEXT,
      errorMessage TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS generation_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generationId INTEGER NOT NULL,
      stepNumber INTEGER NOT NULL,
      stepName TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      output TEXT,
      summary TEXT,
      errorMessage TEXT,
      startedAt TEXT,
      completedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(generationId, stepNumber),
      FOREIGN KEY (generationId) REFERENCES skill_generations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_skill_generations_userId_createdAt
      ON skill_generations(userId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_generation_steps_generationId_stepNumber
      ON generation_steps(generationId, stepNumber);
  `);

  const generationColumns = new Set(
    (
      db.prepare(`PRAGMA table_info(skill_generations)`).all() as Array<{
        name: string;
      }>
    ).map(column => column.name)
  );

  const ensureColumn = (column: string, sqlType: string) => {
    if (generationColumns.has(column)) return;
    db.exec(
      `ALTER TABLE skill_generations ADD COLUMN "${column}" ${sqlType}`
    );
  };

  ensureColumn("llmApiUrl", "TEXT");
  ensureColumn("llmApiKey", "TEXT");
  ensureColumn("llmModel", "TEXT");
  ensureColumn("llmMaxTokens", "INTEGER");
}

async function createDatabaseHandle(
  databaseUrl: string
): Promise<DatabaseHandle> {
  const dialect = detectDatabaseDialect(databaseUrl);

  if (dialect === "sqlite") {
    const filePath = resolveSqliteFilePath(databaseUrl);
    ensureSqliteDirectory(filePath);
    const sqlite = new DatabaseSync(filePath);
    bootstrapSqliteDatabase(sqlite);

    return {
      dialect,
      tables: SQLITE_TABLES,
      db: sqlite,
    };
  }

  if (dialect === "postgresql") {
    const { Pool } = await import("pg");
    return {
      dialect,
      tables: POSTGRES_TABLES,
      db: drizzlePostgres(new Pool({ connectionString: databaseUrl })),
    };
  }

  return {
    dialect,
    tables: MYSQL_TABLES,
    db: drizzleMySql(databaseUrl),
  };
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(String(value));
}

function parseUserRow(row: Record<string, unknown>): User {
  return {
    id: Number(row.id),
    openId: String(row.openId),
    name: row.name == null ? null : String(row.name),
    email: row.email == null ? null : String(row.email),
    loginMethod: row.loginMethod == null ? null : String(row.loginMethod),
    role: String(row.role) as User["role"],
    createdAt: asDate(row.createdAt) ?? new Date(0),
    updatedAt: asDate(row.updatedAt) ?? new Date(0),
    lastSignedIn: asDate(row.lastSignedIn) ?? new Date(0),
  };
}

function parseGenerationRow(row: Record<string, unknown>): SkillGeneration {
  const rawResult = row.result;
  let parsedResult: GenerationResult | null = null;
  if (rawResult != null) {
    parsedResult =
      typeof rawResult === "string"
        ? (JSON.parse(rawResult) as GenerationResult)
        : (rawResult as GenerationResult);
  }

  return {
    id: Number(row.id),
    userId: Number(row.userId),
    skillName: String(row.skillName),
    domain: String(row.domain),
    features: String(row.features),
    scenarios: row.scenarios == null ? null : String(row.scenarios),
    extraNotes: row.extraNotes == null ? null : String(row.extraNotes),
    llmApiUrl: row.llmApiUrl == null ? null : String(row.llmApiUrl),
    llmApiKey: row.llmApiKey == null ? null : String(row.llmApiKey),
    llmModel: row.llmModel == null ? null : String(row.llmModel),
    llmMaxTokens:
      row.llmMaxTokens == null ? null : Number(row.llmMaxTokens),
    status: String(row.status) as SkillGeneration["status"],
    currentStep: Number(row.currentStep),
    result: parsedResult,
    errorMessage: row.errorMessage == null ? null : String(row.errorMessage),
    createdAt: asDate(row.createdAt) ?? new Date(0),
    updatedAt: asDate(row.updatedAt) ?? new Date(0),
    completedAt: asDate(row.completedAt),
  };
}

function parseGenerationStepRow(row: Record<string, unknown>): GenerationStep {
  return {
    id: Number(row.id),
    generationId: Number(row.generationId),
    stepNumber: Number(row.stepNumber),
    stepName: String(row.stepName),
    status: String(row.status) as GenerationStep["status"],
    output: row.output == null ? null : String(row.output),
    summary: row.summary == null ? null : String(row.summary),
    errorMessage: row.errorMessage == null ? null : String(row.errorMessage),
    startedAt: asDate(row.startedAt),
    completedAt: asDate(row.completedAt),
    createdAt: asDate(row.createdAt) ?? new Date(0),
  };
}

function toSqliteValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function buildSqliteUpdate(
  patch: Record<string, unknown>,
  allowedColumns: Set<string>
) {
  const entries = Object.entries(patch).filter(
    ([key, value]) => allowedColumns.has(key) && value !== undefined
  );

  if (entries.length === 0) {
    return null;
  }

  return {
    sql: entries.map(([key]) => `"${key}" = ?`).join(", "),
    params: entries.map(([, value]) => toSqliteValue(value)),
  };
}

export async function getDatabase(): Promise<DatabaseHandle | null> {
  const databaseUrl = resolveDatabaseUrl();

  if (!databaseHandle || cachedDatabaseUrl !== databaseUrl) {
    try {
      databaseHandle = await createDatabaseHandle(databaseUrl);
      cachedDatabaseUrl = databaseUrl;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      databaseHandle = null;
      cachedDatabaseUrl = null;
    }
  }
  return databaseHandle;
}

export async function getDb() {
  return (await getDatabase())?.db ?? null;
}

export async function getDatabaseDialect(): Promise<DatabaseDialect | null> {
  return (await getDatabase())?.dialect ?? null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const database = await getDatabase();
  if (!database) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  const now = new Date();

  if (database.dialect === "sqlite") {
    const db = database.db as SqliteDatabaseSync;
    db.prepare(`
      INSERT INTO users (
        openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(openId) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        loginMethod = excluded.loginMethod,
        role = excluded.role,
        updatedAt = excluded.updatedAt,
        lastSignedIn = excluded.lastSignedIn
    `).run(
      user.openId,
      user.name ?? null,
      user.email ?? null,
      user.loginMethod ?? null,
      role,
      (user.createdAt ?? now).toISOString(),
      (user.updatedAt ?? now).toISOString(),
      (user.lastSignedIn ?? now).toISOString()
    );
    return;
  }

  const { db, dialect, tables } = database;

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {
      updatedAt: now,
    };

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    values.role = role;
    updateSet.role = role;

    if (!values.lastSignedIn) {
      values.lastSignedIn = now;
    }

    if (dialect === "postgresql") {
      await db.insert(tables.users).values(values).onConflictDoUpdate({
        target: tables.users.openId,
        set: updateSet,
      });
      return;
    }

    await db.insert(tables.users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const database = await getDatabase();
  if (!database) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  if (database.dialect === "sqlite") {
    const row = (database.db as SqliteDatabaseSync)
      .prepare(`SELECT * FROM users WHERE openId = ? LIMIT 1`)
      .get(openId) as Record<string, unknown> | undefined;
    return row ? parseUserRow(row) : undefined;
  }

  const { db, tables } = database;
  const result = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createGeneration(data: InsertSkillGeneration) {
  const database = await getDatabase();
  if (!database) throw new Error("Database not available");

  if (database.dialect === "sqlite") {
    const db = database.db as SqliteDatabaseSync;
    const now = new Date().toISOString();
    const result = db
      .prepare(`
        INSERT INTO skill_generations (
          userId, skillName, domain, features, scenarios, extraNotes,
          llmApiUrl, llmApiKey, llmModel, llmMaxTokens, status, currentStep, result,
          errorMessage, createdAt, updatedAt, completedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.userId,
        data.skillName,
        data.domain,
        data.features,
        data.scenarios ?? null,
        data.extraNotes ?? null,
        data.llmApiUrl ?? null,
        data.llmApiKey ?? null,
        data.llmModel ?? null,
        data.llmMaxTokens ?? null,
        data.status ?? "pending",
        data.currentStep ?? 0,
        data.result ? JSON.stringify(data.result) : null,
        data.errorMessage ?? null,
        (data.createdAt ?? new Date(now)).toISOString(),
        (data.updatedAt ?? new Date(now)).toISOString(),
        data.completedAt ? data.completedAt.toISOString() : null
      );

    return Number(result.lastInsertRowid);
  }

  const { db, dialect, tables } = database;

  if (dialect === "postgresql") {
    const [result] = await db
      .insert(tables.skillGenerations)
      .values(data)
      .returning({ id: tables.skillGenerations.id });
    return result.id;
  }

  const [result] = await db
    .insert(tables.skillGenerations)
    .values(data)
    .$returningId();
  return result.id;
}

export async function getGeneration(id: number) {
  const database = await getDatabase();
  if (!database) return undefined;

  if (database.dialect === "sqlite") {
    const row = (database.db as SqliteDatabaseSync)
      .prepare(`SELECT * FROM skill_generations WHERE id = ? LIMIT 1`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? parseGenerationRow(row) : undefined;
  }

  const { db, tables } = database;
  const [generation] = await db
    .select()
    .from(tables.skillGenerations)
    .where(eq(tables.skillGenerations.id, id))
    .limit(1);
  return generation;
}

export async function getGenerationWithSteps(id: number) {
  const generation = await getGeneration(id);
  if (!generation) return undefined;

  const steps = await listGenerationSteps(id);
  return { ...generation, steps };
}

export async function getUserGenerations(userId: number, limit = 20) {
  const database = await getDatabase();
  if (!database) return [];

  if (database.dialect === "sqlite") {
    const rows = (database.db as SqliteDatabaseSync)
      .prepare(
        `SELECT * FROM skill_generations
         WHERE userId = ?
         ORDER BY datetime(createdAt) DESC
         LIMIT ?`
      )
      .all(userId, limit) as Record<string, unknown>[];
    return rows.map(parseGenerationRow);
  }

  const { db, tables } = database;
  return db
    .select()
    .from(tables.skillGenerations)
    .where(eq(tables.skillGenerations.userId, userId))
    .orderBy(desc(tables.skillGenerations.createdAt))
    .limit(limit);
}

export async function listGenerationSteps(generationId: number) {
  const database = await getDatabase();
  if (!database) return [];

  if (database.dialect === "sqlite") {
    const rows = (database.db as SqliteDatabaseSync)
      .prepare(
        `SELECT * FROM generation_steps
         WHERE generationId = ?
         ORDER BY stepNumber ASC`
      )
      .all(generationId) as Record<string, unknown>[];
    return rows.map(parseGenerationStepRow);
  }

  const { db, tables } = database;
  return db
    .select()
    .from(tables.generationSteps)
    .where(eq(tables.generationSteps.generationId, generationId))
    .orderBy(tables.generationSteps.stepNumber);
}

export async function createGenerationSteps(
  steps: InsertGenerationStep[]
): Promise<void> {
  if (steps.length === 0) return;

  const database = await getDatabase();
  if (!database) throw new Error("Database not available");

  if (database.dialect === "sqlite") {
    const db = database.db as SqliteDatabaseSync;
    const stmt = db.prepare(`
      INSERT INTO generation_steps (
        generationId, stepNumber, stepName, status, output, summary,
        errorMessage, startedAt, completedAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(generationId, stepNumber) DO UPDATE SET
        stepName = excluded.stepName,
        status = excluded.status,
        output = excluded.output,
        summary = excluded.summary,
        errorMessage = excluded.errorMessage,
        startedAt = excluded.startedAt,
        completedAt = excluded.completedAt
    `);

    for (const step of steps) {
      stmt.run(
        step.generationId,
        step.stepNumber,
        step.stepName,
        step.status ?? "pending",
        step.output ?? null,
        step.summary ?? null,
        step.errorMessage ?? null,
        step.startedAt ? step.startedAt.toISOString() : null,
        step.completedAt ? step.completedAt.toISOString() : null,
        (step.createdAt ?? new Date()).toISOString()
      );
    }
    return;
  }

  const { db, tables } = database;
  await db.insert(tables.generationSteps).values(steps);
}

export async function updateGeneration(
  generationId: number,
  patch: Partial<SkillGeneration>
): Promise<void> {
  const database = await getDatabase();
  if (!database) throw new Error("Database not available");

  const nextPatch = {
    ...patch,
    updatedAt: patch.updatedAt ?? new Date(),
  };

  if (database.dialect === "sqlite") {
    const db = database.db as SqliteDatabaseSync;
    const compiled = buildSqliteUpdate(nextPatch, SQLITE_GENERATION_COLUMNS);
    if (!compiled) return;

    db.prepare(
      `UPDATE skill_generations SET ${compiled.sql} WHERE id = ?`
    ).run(...(compiled.params as any[]), generationId);
    return;
  }

  const { db, tables } = database;
  await db
    .update(tables.skillGenerations)
    .set(nextPatch)
    .where(eq(tables.skillGenerations.id, generationId));
}

export async function updateGenerationStepById(
  stepId: number,
  patch: Partial<GenerationStep>
): Promise<void> {
  const database = await getDatabase();
  if (!database) throw new Error("Database not available");

  if (database.dialect === "sqlite") {
    const db = database.db as SqliteDatabaseSync;
    const compiled = buildSqliteUpdate(patch, SQLITE_STEP_COLUMNS);
    if (!compiled) return;
    db.prepare(`UPDATE generation_steps SET ${compiled.sql} WHERE id = ?`).run(
      ...(compiled.params as any[]),
      stepId
    );
    return;
  }

  const { db, tables } = database;
  await db
    .update(tables.generationSteps)
    .set(patch)
    .where(eq(tables.generationSteps.id, stepId));
}

export async function updateGenerationStepByNumber(
  generationId: number,
  stepNumber: number,
  patch: Partial<GenerationStep>
): Promise<void> {
  const database = await getDatabase();
  if (!database) throw new Error("Database not available");

  if (database.dialect === "sqlite") {
    const db = database.db as SqliteDatabaseSync;
    const compiled = buildSqliteUpdate(patch, SQLITE_STEP_COLUMNS);
    if (!compiled) return;
    db.prepare(
      `UPDATE generation_steps SET ${compiled.sql} WHERE generationId = ? AND stepNumber = ?`
    ).run(...(compiled.params as any[]), generationId, stepNumber);
    return;
  }

  const { db, tables } = database;
  await db
    .update(tables.generationSteps)
    .set(patch)
    .where(
      and(
        eq(tables.generationSteps.generationId, generationId),
        eq(tables.generationSteps.stepNumber, stepNumber)
      )
    );
}

export async function deleteGenerationStepsByGenerationId(
  generationId: number
): Promise<void> {
  const database = await getDatabase();
  if (!database) throw new Error("Database not available");

  if (database.dialect === "sqlite") {
    (database.db as SqliteDatabaseSync)
      .prepare(`DELETE FROM generation_steps WHERE generationId = ?`)
      .run(generationId);
    return;
  }

  const { db, tables } = database;
  await db
    .delete(tables.generationSteps)
    .where(eq(tables.generationSteps.generationId, generationId));
}

export async function deleteGenerationById(generationId: number): Promise<void> {
  const database = await getDatabase();
  if (!database) throw new Error("Database not available");

  if (database.dialect === "sqlite") {
    (database.db as SqliteDatabaseSync)
      .prepare(`DELETE FROM skill_generations WHERE id = ?`)
      .run(generationId);
    return;
  }

  const { db, tables } = database;
  await db
    .delete(tables.skillGenerations)
    .where(eq(tables.skillGenerations.id, generationId));
}
