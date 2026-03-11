import { desc, eq } from "drizzle-orm";
import { drizzle as drizzleMySql } from "drizzle-orm/mysql2";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { ENV } from "./_core/env";
import {
  detectDatabaseDialect,
  type DatabaseDialect,
} from "../drizzle/dialect";
import type { InsertSkillGeneration, InsertUser } from "../drizzle/schema";
import * as mysqlSchema from "../drizzle/mysqlSchema";
import * as pgSchema from "../drizzle/pgSchema";

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

let databaseHandle: DatabaseHandle | null = null;
let cachedDatabaseUrl: string | null = null;

async function createDatabaseHandle(
  databaseUrl: string
): Promise<DatabaseHandle> {
  const dialect = detectDatabaseDialect(databaseUrl);

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

export async function getDatabase(): Promise<DatabaseHandle | null> {
  const databaseUrl = process.env.DATABASE_URL ?? ENV.databaseUrl;
  if (!databaseUrl) {
    return null;
  }

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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const database = await getDatabase();
  if (!database) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const { db, dialect, tables } = database;

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {
      updatedAt: new Date(),
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
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
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

  const { db, tables } = database;
  const [generation] = await db
    .select()
    .from(tables.skillGenerations)
    .where(eq(tables.skillGenerations.id, id))
    .limit(1);
  return generation;
}

export async function getGenerationWithSteps(id: number) {
  const database = await getDatabase();
  if (!database) return undefined;

  const { db, tables } = database;
  const [generation] = await db
    .select()
    .from(tables.skillGenerations)
    .where(eq(tables.skillGenerations.id, id))
    .limit(1);
  if (!generation) return undefined;

  const steps = await db
    .select()
    .from(tables.generationSteps)
    .where(eq(tables.generationSteps.generationId, id))
    .orderBy(tables.generationSteps.stepNumber);

  return { ...generation, steps };
}

export async function getUserGenerations(userId: number, limit = 20) {
  const database = await getDatabase();
  if (!database) return [];

  const { db, tables } = database;
  return db
    .select()
    .from(tables.skillGenerations)
    .where(eq(tables.skillGenerations.userId, userId))
    .orderBy(desc(tables.skillGenerations.createdAt))
    .limit(limit);
}
