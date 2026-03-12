import { z } from "zod";
import { ENV } from "./env";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDatabaseDialect } from "../db";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  runtimeConfig: publicProcedure.query(async () => ({
    defaultApiUrl: ENV.forgeApiUrl.trim() || null,
    hasDefaultApiKey: Boolean(ENV.forgeApiKey.trim()),
    defaultModel: ENV.forgeModel,
    defaultMaxTokens: ENV.forgeMaxTokens,
    useOpenAIOAuth: ENV.useOpenAIOAuth,
    databaseDialect: await getDatabaseDialect(),
  })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
