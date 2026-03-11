CREATE TYPE "public"."generation_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "generation_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"generationId" integer NOT NULL,
	"stepNumber" integer NOT NULL,
	"stepName" varchar(128) NOT NULL,
	"status" "step_status" DEFAULT 'pending' NOT NULL,
	"output" text,
	"summary" varchar(512),
	"errorMessage" text,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"skillName" varchar(256) NOT NULL,
	"domain" varchar(256) NOT NULL,
	"features" text NOT NULL,
	"scenarios" text,
	"extraNotes" text,
	"status" "generation_status" DEFAULT 'pending' NOT NULL,
	"currentStep" integer DEFAULT 0 NOT NULL,
	"result" jsonb,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
