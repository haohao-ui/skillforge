export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const GENERATION_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const STEP_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export type GenerationResultFile = {
  path: string;
  content: string;
};

export type GenerationResult = {
  directory_tree: string;
  files: GenerationResultFile[];
  usage: unknown;
  validation_passed: boolean;
  partial: boolean;
};

export type GenerationLLMConfig = {
  model: string | null;
  maxTokens: number | null;
};

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export type InsertUser = {
  id?: number;
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
  lastSignedIn?: Date;
};

export type SkillGeneration = {
  id: number;
  userId: number;
  skillName: string;
  domain: string;
  features: string;
  scenarios: string | null;
  extraNotes: string | null;
  llmApiUrl: string | null;
  llmApiKey: string | null;
  llmModel: string | null;
  llmMaxTokens: number | null;
  status: GenerationStatus;
  currentStep: number;
  result: GenerationResult | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type InsertSkillGeneration = {
  id?: number;
  userId: number;
  skillName: string;
  domain: string;
  features: string;
  scenarios?: string | null;
  extraNotes?: string | null;
  llmApiUrl?: string | null;
  llmApiKey?: string | null;
  llmModel?: string | null;
  llmMaxTokens?: number | null;
  status?: GenerationStatus;
  currentStep?: number;
  result?: GenerationResult | null;
  errorMessage?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date | null;
};

export type GenerationStep = {
  id: number;
  generationId: number;
  stepNumber: number;
  stepName: string;
  status: StepStatus;
  output: string | null;
  summary: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export type InsertGenerationStep = {
  id?: number;
  generationId: number;
  stepNumber: number;
  stepName: string;
  status?: StepStatus;
  output?: string | null;
  summary?: string | null;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt?: Date;
};
