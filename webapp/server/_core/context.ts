import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function createLocalUser(): User {
  return {
    id: 1,
    openId: "local-dev-user",
    name: "Local User",
    email: null,
    loginMethod: "local",
    role: "admin",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    lastSignedIn: new Date(),
  };
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null =
    ENV.authEnabled || ENV.isProduction ? null : createLocalUser();

  if (ENV.authEnabled) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
