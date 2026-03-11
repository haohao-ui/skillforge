const isUnset = (value: string) => {
  const normalized = value.trim();
  return (
    normalized.length === 0 ||
    normalized.startsWith("your-") ||
    normalized.includes("your-oauth-app-id") ||
    normalized.includes("your-random-jwt-secret")
  );
};

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  oAuthPortalUrl: process.env.VITE_OAUTH_PORTAL_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  forgeModel: process.env.BUILT_IN_FORGE_MODEL ?? "gemini-2.5-flash",
  forgeMaxTokens: Math.max(
    1,
    Number.parseInt(process.env.BUILT_IN_FORGE_MAX_TOKENS ?? "4096", 10) || 4096
  ),
  useOpenAIOAuth: process.env.USE_OPENAI_OAUTH === "true",
  openAIOAuthToken: process.env.OPENAI_OAUTH_TOKEN ?? "",
  authEnabled: false,
};

ENV.authEnabled =
  !isUnset(ENV.appId) &&
  !isUnset(ENV.cookieSecret) &&
  !isUnset(ENV.oAuthServerUrl) &&
  !isUnset(ENV.oAuthPortalUrl);
