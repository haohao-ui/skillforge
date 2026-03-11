import {
  customType,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  GENERATION_STATUSES,
  STEP_STATUSES,
  USER_ROLES,
  type GenerationResult,
} from "./schema";

const mediumtext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "mediumtext";
  },
});

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", USER_ROLES).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const skillGenerations = mysqlTable("skill_generations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  skillName: varchar("skillName", { length: 256 }).notNull(),
  domain: varchar("domain", { length: 256 }).notNull(),
  features: text("features").notNull(),
  scenarios: text("scenarios"),
  extraNotes: text("extraNotes"),
  status: mysqlEnum("status", GENERATION_STATUSES).default("pending").notNull(),
  currentStep: int("currentStep").default(0).notNull(),
  result: json("result").$type<GenerationResult | null>(),
  errorMessage: mediumtext("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export const generationSteps = mysqlTable("generation_steps", {
  id: int("id").autoincrement().primaryKey(),
  generationId: int("generationId").notNull(),
  stepNumber: int("stepNumber").notNull(),
  stepName: varchar("stepName", { length: 128 }).notNull(),
  status: mysqlEnum("status", STEP_STATUSES).default("pending").notNull(),
  output: mediumtext("output"),
  summary: varchar("summary", { length: 512 }),
  errorMessage: mediumtext("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
