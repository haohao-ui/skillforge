import { ENV } from "./env";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname since this is an ESM module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We will load oauth token explicitly inside invokeLLM if USE_OPENAI_OAUTH is enabled

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?:
      | "audio/mpeg"
      | "audio/wav"
      | "application/pdf"
      | "audio/mp4"
      | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const OPENAI_OAUTH_MODELS = [
  "gpt-5.1",
  "gpt-5.1-codex-max",
  "gpt-5.1-codex-mini",
  "gpt-5.2",
  "gpt-5.2-codex",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gpt-5.4",
] as const;

type OpenAIOAuthModel = (typeof OPENAI_OAUTH_MODELS)[number];

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = (useOAuth: boolean) => {
  if (useOAuth) {
    // If we're using the OpenAI Codex auth token, hit the real OpenAI API
    return "https://api.openai.com/v1/chat/completions";
  }

  const configuredUrl = ENV.forgeApiUrl?.trim();
  if (!configuredUrl) {
    return "https://forge.manus.im/v1/chat/completions";
  }

  const normalized = configuredUrl.replace(/\/$/, "");
  if (/(^|\/)v1\/chat\/completions$/.test(normalized)) {
    return normalized;
  }

  return `${normalized}/v1/chat/completions`;
};

const resolveModelName = (useOAuth: boolean) => {
  const configuredModel = ENV.forgeModel?.trim();

  if (configuredModel) {
    return configuredModel;
  }

  return useOAuth ? "gpt-5.4" : "gemini-2.5-flash";
};

const resolveOAuthModelName = (modelName: string): OpenAIOAuthModel => {
  if (OPENAI_OAUTH_MODELS.includes(modelName as OpenAIOAuthModel)) {
    return modelName as OpenAIOAuthModel;
  }

  throw new Error(
    `BUILT_IN_FORGE_MODEL "${modelName}" is not supported in OpenAI OAuth mode. Supported models: ${OPENAI_OAUTH_MODELS.join(", ")}`
  );
};

const assertApiKey = (useOAuth: boolean, token: string | null) => {
  if (useOAuth) {
    if (!token) {
      throw new Error(
        "USE_OPENAI_OAUTH is enabled but no OAuth token is configured (check OPENAI_OAUTH_TOKEN or .openai-credentials.json)"
      );
    }
    return;
  }

  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const useOAuth = ENV.useOpenAIOAuth;
  const modelName = resolveModelName(useOAuth);

  let resolveToken: string | null = null;
  if (useOAuth) {
    resolveToken = ENV.openAIOAuthToken || null;
    if (!resolveToken) {
      try {
        // Since we run the project from /webapp normally, process.cwd() is safest
        // We'll check process.cwd() and optionally fallback to an absolute __dirname offset
        const pathsToTry = [
          path.resolve(process.cwd(), ".openai-credentials.json"),
          path.resolve(__dirname, "../../.openai-credentials.json")
        ];

        for (const credsPath of pathsToTry) {
          if (fs.existsSync(credsPath)) {
            const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
            if (creds.access) {
              resolveToken = creds.access;
              break;
            }
          }
        }
      } catch (err) {}
    }
  }

  assertApiKey(useOAuth, resolveToken);

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  if (useOAuth) {
    const oauthModelName = resolveOAuthModelName(modelName);
    const { completeSimple, getModel } = await import("@mariozechner/pi-ai");
    const codexModel = getModel("openai-codex", oauthModelName);

    const systemMsgs = messages.filter(m => m.role === "system");
    const systemPrompt = systemMsgs.length > 0
      ? systemMsgs.map(m => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n")
      : "You are a helpful AI assistant.";

    const formattedMessages = messages
      .filter(m => m.role !== "system")
      .map(m => {
        const norm = normalizeMessage(m);
        if (norm.role === "tool" || norm.role === "function") {
          return {
            role: "toolResult",
            toolCallId: (norm as any).tool_call_id,
            toolName: (norm as any).name || "unknown",
            content: [{ type: "text", text: String(norm.content) }],
            isError: false,
            timestamp: Date.now()
          };
        }
        return {
          role: norm.role,
          content: norm.content,
          timestamp: Date.now()
        };
      });

    const mappedTools = tools?.map(t => ({
      name: t.function.name,
      description: t.function.description || "",
      parameters: t.function.parameters || { type: "object", properties: {} }
    }));

    console.log("[LLM Invoke] URL: @mariozechner/pi-ai (ChatGPT OAuth)");
    console.log("[LLM Invoke] Model explicitly used:", `openai-codex/${modelName}`);

    const res = await completeSimple(
      codexModel,
      {
        systemPrompt,
        messages: formattedMessages as any,
        tools: mappedTools as any
      },
      { apiKey: resolveToken || undefined, maxTokens: ENV.forgeMaxTokens }
    );

    const toolCalls = res.content
      .filter((c: any) => c.type === "toolCall")
      .map((c: any) => ({
        id: c.id,
        type: "function",
        function: {
          name: c.name,
          arguments: typeof c.arguments === "string" ? c.arguments : JSON.stringify(c.arguments)
        }
      }));

    const textParts = res.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text);

    return {
      id: "chatcmpl-" + Date.now().toString(),
      created: Math.floor(Date.now() / 1000),
      model: modelName,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: textParts.join("\n"),
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: res.stopReason === "toolUse" || toolCalls.length > 0 ? "tool_calls" : "stop"
      }],
      usage: {
        prompt_tokens: res.usage?.input || 0,
        completion_tokens: res.usage?.output || 0,
        total_tokens: res.usage?.totalTokens || 0
      }
    } as InvokeResult;
  }

  const payload: Record<string, unknown> = {
    model: modelName,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = ENV.forgeMaxTokens;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const apiUrl = resolveApiUrl(useOAuth);
  console.log("[LLM Invoke] URL:", apiUrl);
  // Log the payload but truncate messages to not flood the logs if they are huge
  const logPayload = {
    ...payload,
    messages: (payload.messages as unknown[]).length + " messages",
  };
  console.log(
    "[LLM Invoke] Payload (preview):",
    JSON.stringify(logPayload, null, 2)
  );
  console.log("[LLM Invoke] Model explicitly used:", payload.model);
  const bearerToken = useOAuth ? resolveToken : ENV.forgeApiKey;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}
