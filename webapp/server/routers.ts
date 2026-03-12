import { COOKIE_NAME } from "@shared/const";
import type { SkillGeneration } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  createGeneration,
  getGenerationWithSteps,
  getUserGenerations,
} from "./db";
import {
  runGenerationPipeline,
  resumeGenerationPipeline,
  cancelGeneration,
  deleteGeneration,
  STEPS,
} from "./skillEngine";
import { z } from "zod";

function sanitizeGeneration<T extends { llmApiKey?: string | null }>(
  generation: T
): Omit<T, "llmApiKey">;
function sanitizeGeneration<T extends { llmApiKey?: string | null }>(
  generation: T | null
): Omit<T, "llmApiKey"> | null {
  if (!generation) return null;
  const { llmApiKey: _llmApiKey, ...safeGeneration } = generation;
  return safeGeneration;
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  skill: router({
    /** Create a new generation and start the pipeline */
    generate: protectedProcedure
      .input(
        z.object({
          skillName: z.string().min(1).max(256),
          domain: z.string().min(1).max(256),
          features: z.string().min(1),
          scenarios: z.string().optional(),
          extraNotes: z.string().optional(),
          llmApiUrl: z.string().trim().min(1).max(2048).optional(),
          llmApiKey: z.string().trim().min(1).max(4096).optional(),
          llmModel: z.string().trim().min(1).max(128).optional(),
          llmMaxTokens: z.number().int().min(1).max(128000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const genId = await createGeneration({
          userId: ctx.user.id,
          skillName: input.skillName,
          domain: input.domain,
          features: input.features,
          scenarios: input.scenarios || null,
          extraNotes: input.extraNotes || null,
          llmApiUrl: input.llmApiUrl || null,
          llmApiKey: input.llmApiKey || null,
          llmModel: input.llmModel || null,
          llmMaxTokens: input.llmMaxTokens ?? null,
        });
        // Run pipeline in background (don't await)
        runGenerationPipeline(genId).catch(err => {
          console.error(
            `[SkillEngine] Pipeline failed for generation ${genId}:`,
            err
          );
        });
        return { id: genId };
      }),

    /** Get generation status with all steps */
    getStatus: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const gen = await getGenerationWithSteps(input.id);
        if (!gen || gen.userId !== ctx.user.id) return null;
        return sanitizeGeneration(gen);
      }),

    /** List user's generation history */
    history: protectedProcedure.query(async ({ ctx }) => {
      const generations = await getUserGenerations(ctx.user.id);
      return generations.map((generation: SkillGeneration) =>
        sanitizeGeneration(generation)
      );
    }),

    /** Resume a failed generation from the last failed step */
    resume: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const gen = await getGenerationWithSteps(input.id);
        if (!gen || gen.userId !== ctx.user.id) {
          throw new Error("Generation not found");
        }
        if (
          gen.status !== "failed" &&
          gen.status !== "completed" &&
          gen.status !== "cancelled"
        ) {
          throw new Error(
            "Can only resume failed, completed, or cancelled generations"
          );
        }
        // Run resume in background
        resumeGenerationPipeline(input.id).catch(err => {
          console.error(
            `[SkillEngine] Resume failed for generation ${input.id}:`,
            err
          );
        });
        return { id: input.id };
      }),

    /** Cancel a running generation */
    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const gen = await getGenerationWithSteps(input.id);
        if (!gen || gen.userId !== ctx.user.id) {
          throw new Error("Generation not found");
        }
        if (gen.status !== "running" && gen.status !== "pending") {
          throw new Error("Can only cancel running or pending generations");
        }
        await cancelGeneration(input.id);
        return { success: true };
      }),

    /** Delete a generation and all its steps */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const gen = await getGenerationWithSteps(input.id);
        if (!gen || gen.userId !== ctx.user.id) {
          throw new Error("Generation not found");
        }
        await deleteGeneration(input.id);
        return { success: true };
      }),

    /** Get step definitions */
    steps: publicProcedure.query(() => STEPS),
  }),
});

export type AppRouter = typeof appRouter;
