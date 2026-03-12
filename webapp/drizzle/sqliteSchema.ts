import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  GENERATION_STATUSES,
  STEP_STATUSES,
  USER_ROLES,
  type GenerationResult,
} from "./schema";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: USER_ROLES }).default("user").notNull(),
  createdAt: text("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updatedAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  lastSignedIn: text("lastSignedIn")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const skillGenerations = sqliteTable("skill_generations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  skillName: text("skillName").notNull(),
  domain: text("domain").notNull(),
  features: text("features").notNull(),
  scenarios: text("scenarios"),
  extraNotes: text("extraNotes"),
  llmApiUrl: text("llmApiUrl"),
  llmApiKey: text("llmApiKey"),
  llmModel: text("llmModel"),
  llmMaxTokens: integer("llmMaxTokens"),
  status: text("status", { enum: GENERATION_STATUSES })
    .default("pending")
    .notNull(),
  currentStep: integer("currentStep").default(0).notNull(),
  result: text("result", { mode: "json" }).$type<GenerationResult | null>(),
  errorMessage: text("errorMessage"),
  createdAt: text("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updatedAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  completedAt: text("completedAt"),
});

export const generationSteps = sqliteTable("generation_steps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generationId: integer("generationId").notNull(),
  stepNumber: integer("stepNumber").notNull(),
  stepName: text("stepName").notNull(),
  status: text("status", { enum: STEP_STATUSES }).default("pending").notNull(),
  output: text("output"),
  summary: text("summary"),
  errorMessage: text("errorMessage"),
  startedAt: text("startedAt"),
  completedAt: text("completedAt"),
  createdAt: text("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
