import { completeSimple, getModel } from "@mariozechner/pi-ai";
import * as fs from "fs";

async function main() {
  const creds = JSON.parse(fs.readFileSync(".openai-credentials.json", "utf-8"));
  const token = creds.access;
  
  const model = getModel("openai-codex", "gpt-5.4");
  console.log("Model:", model.name);

  const res = await completeSimple(
    model,
    {
      systemPrompt: "You are a helpful assistant.",
      messages: [{ role: "user", content: "Say 'hello world'", timestamp: Date.now() }]
    },
    { apiKey: token, maxTokens: 100 }
  );

  console.log("Response:", res);
}

main().catch(console.error);
