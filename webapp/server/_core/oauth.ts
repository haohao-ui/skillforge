import {
  COOKIE_NAME,
  ONE_YEAR_MS,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_TTL_MS,
} from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import * as db from "../db";
import {
  getOAuthStateCookieOptions,
  getSessionCookieOptions,
} from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getCookie(req: Request, key: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  return parseCookieHeader(cookieHeader)[key];
}

function resolveOAuthPortalUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  const url = new URL(trimmed);

  if (!url.pathname.endsWith("/app-auth")) {
    url.pathname = "/app-auth";
  }

  return url;
}

function getRequestOrigin(req: Request) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(",")[0] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");

  if (!host) {
    throw new Error("Unable to determine request host");
  }

  return `${proto.trim()}://${host}`;
}

function getRedirectUri(req: Request) {
  return `${getRequestOrigin(req)}/api/oauth/callback`;
}

function generateOAuthState() {
  return randomBytes(32).toString("base64url");
}

function isMatchingState(expected: string | undefined, actual: string) {
  if (!expected) return false;

  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);

  if (expectedBytes.length !== actualBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, actualBytes);
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/start", async (req: Request, res: Response) => {
    if (!ENV.authEnabled) {
      res.status(503).json({ error: "Authentication is not configured" });
      return;
    }

    try {
      const redirectUri = getRedirectUri(req);
      const state = generateOAuthState();
      const loginUrl = resolveOAuthPortalUrl(ENV.oAuthPortalUrl);

      loginUrl.searchParams.set("appId", ENV.appId);
      loginUrl.searchParams.set("redirectUri", redirectUri);
      loginUrl.searchParams.set("responseType", "code");
      loginUrl.searchParams.set("state", state);
      loginUrl.searchParams.set("type", "signIn");

      res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
        ...getOAuthStateCookieOptions(req),
        maxAge: OAUTH_STATE_TTL_MS,
      });

      res.redirect(302, loginUrl.toString());
    } catch (error) {
      console.error("[OAuth] Start failed", error);
      res.status(500).json({ error: "OAuth start failed" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const expectedState = getCookie(req, OAUTH_STATE_COOKIE_NAME);

      res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
        ...getOAuthStateCookieOptions(req),
        maxAge: -1,
      });

      if (!isMatchingState(expectedState, state)) {
        res.status(400).json({ error: "invalid oauth state" });
        return;
      }

      const tokenResponse = await sdk.exchangeCodeForToken(
        code,
        getRedirectUri(req)
      );
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
