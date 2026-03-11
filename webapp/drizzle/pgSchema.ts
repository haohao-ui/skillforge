import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import {
  GENERATION_STATUSES,
  STEP_STATUSES,
  USER_ROLES,
  type GenerationResult,
} from "./schema";

export const userRoleEnum = pgEnum("role", USER_ROLES);
export const generationStatusEnum = pgEnum(
  "generation_status",
  GENERATION_STATUSES
);
export const stepStatusEnum = pgEnum("step_status", STEP_STATUSES);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { mode: "date" })
    .defaultNow()
    .notNull(),
});

export const skillGenerations = pgTable("skill_generations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  skillName: varchar("skillName", { length: 256 }).notNull(),
  domain: varchar("domain", { length: 256 }).notNull(),
  features: text("features").notNull(),
  scenarios: text("scenarios"),
  extraNotes: text("extraNotes"),
  status: generationStatusEnum("status").default("pending").notNull(),
  currentStep: integer("currentStep").default(0).notNull(),
  result: jsonb("result").$type<GenerationResult | null>(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  completedAt: timestamp("completedAt", { mode: "date" }),
});

export const generationSteps = pgTable("generation_steps", {
  id: serial("id").primaryKey(),
  generationId: integer("generationId").notNull(),
  stepNumber: integer("stepNumber").notNull(),
  stepName: varchar("stepName", { length: 128 }).notNull(),
  status: stepStatusEnum("status").default("pending").notNull(),
  output: text("output"),
  summary: varchar("summary", { length: 512 }),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt", { mode: "date" }),
  completedAt: timestamp("completedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
