import { loginOpenAICodex } from "@mariozechner/pi-ai/oauth";
import * as p from "@clack/prompts";
import open from "open";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.resolve(__dirname, "../.openai-credentials.json");

async function main() {
  p.intro("OpenAI Codex OAuth Setup");

  const spin = p.spinner();

  try {
    const creds = await loginOpenAICodex({
      onAuth: async ({ url }) => {
        p.note(
          "Browser will open for OpenAI authentication.\nIf the callback doesn't auto-complete, paste the redirect URL.\nOpenAI OAuth uses localhost:1455 for the callback.",
          "OpenAI Codex OAuth"
        );
        spin.start("Waiting for browser authentication...");
        await open(url);
      },
      onPrompt: async prompt => {
        spin.stop("Browser action required");
        const code = await p.text({
          message: prompt.message,
          placeholder: prompt.placeholder,
          validate: val =>
            val && typeof val === "string" && val.trim().length > 0
              ? undefined
              : "Required",
        });

        if (typeof code === "symbol") {
          process.exit(1);
        }

        spin.start("Verifying authentication...");
        return String(code);
      },
      onProgress: msg => {
        spin.message(msg);
      },
    });

    if (creds) {
      spin.stop("Authentication successful!");
      await fs.writeFile(
        CREDENTIALS_PATH,
        JSON.stringify(creds, null, 2),
        "utf-8"
      );
      p.outro(`Credentials saved to ${CREDENTIALS_PATH}`);
    } else {
      spin.stop("Authentication yielded no credentials.");
      p.outro("Setup failed or cancelled.");
    }
  } catch (err) {
    spin.stop("OpenAI OAuth failed");
    p.log.error(String(err));
    p.outro("Setup failed.");
    process.exit(1);
  }
}

main().catch(console.error);
