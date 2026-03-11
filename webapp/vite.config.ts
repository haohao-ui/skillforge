import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming
const DEBUG_COLLECTOR_PATH = "/__manus__/debug-collector.js";
const DEBUG_COLLECTOR_SCRIPT = String.raw`(() => {
  if (window.__manusDebugCollectorLoaded) return;
  window.__manusDebugCollectorLoaded = true;

  const pendingConsoleLogs = [];

  const safeSerialize = value => {
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const flush = () => {
    if (pendingConsoleLogs.length === 0) return;

    const payload = JSON.stringify({
      consoleLogs: pendingConsoleLogs.splice(0, pendingConsoleLogs.length),
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/__manus__/logs", blob);
      return;
    }

    fetch("/__manus__/logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  };

  const wrapConsole = level => {
    const original = console[level];
    console[level] = (...args) => {
      pendingConsoleLogs.push({
        level,
        args: args.map(safeSerialize),
        href: window.location.href,
      });

      if (pendingConsoleLogs.length >= 20) {
        flush();
      }

      return original.apply(console, args);
    };
  };

  ["log", "info", "warn", "error"].forEach(wrapConsole);

  window.addEventListener("error", event => {
    pendingConsoleLogs.push({
      level: "error",
      args: ["Unhandled error: " + event.message],
      href: window.location.href,
    });
    flush();
  });

  window.addEventListener("unhandledrejection", event => {
    pendingConsoleLogs.push({
      level: "error",
      args: ["Unhandled rejection: " + safeSerialize(event.reason)],
      href: window.location.href,
    });
    flush();
  });

  window.addEventListener("beforeunload", flush);
  window.setInterval(flush, 5000);
})();`;

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function isConfigured(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function vitePluginConditionalAnalytics(): Plugin {
  return {
    name: "conditional-analytics",
    transformIndexHtml(html) {
      const endpoint = process.env.VITE_ANALYTICS_ENDPOINT?.trim();
      const websiteId = process.env.VITE_ANALYTICS_WEBSITE_ID?.trim();

      if (!isConfigured(endpoint) || !isConfigured(websiteId)) {
        return html;
      }

      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              defer: true,
              src: `${endpoint}/umami`,
              "data-website-id": websiteId,
            },
            injectTo: "body",
          },
        ],
      };
    },
  };
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map(entry => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: DEBUG_COLLECTOR_PATH,
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use(DEBUG_COLLECTOR_PATH, (req, res, next) => {
        if (req.method !== "GET") {
          return next();
        }

        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.end(DEBUG_COLLECTOR_SCRIPT);
      });

      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
  vitePluginManusRuntime(),
  vitePluginManusDebugCollector(),
  vitePluginConditionalAnalytics(),
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
