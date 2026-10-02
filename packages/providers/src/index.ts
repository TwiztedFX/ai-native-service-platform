export interface CompletionRequest {
  system: string;
  user: string;
  model: string;
}

export interface CompletionResult {
  text: string;
  provider: string;
  model: string;
}

export interface CompletionClient {
  readonly provider: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export class ProviderNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";

  constructor() {
    super("No AI provider key is configured.");
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderResponseError extends Error {
  readonly code = "PROVIDER_RESPONSE";

  constructor(message: string) {
    super(message);
    this.name = "ProviderResponseError";
  }
}

export function createDisabledClient(): CompletionClient {
  return {
    provider: "disabled",
    complete(): Promise<CompletionResult> {
      return Promise.reject(new ProviderNotConfiguredError());
    },
  };
}

export function createOpenAiCompatibleClient(options: {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): CompletionClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    provider: "openai-compatible",
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      if (!options.apiKey) throw new ProviderNotConfiguredError();
      const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          temperature: 0,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new ProviderResponseError(`AI provider returned ${response.status}.`);
      }
      const payload: unknown = await response.json();
      const text = readContent(payload);
      if (!text) throw new ProviderResponseError("AI provider returned empty content.");
      return { text, provider: "openai-compatible", model: request.model };
    },
  };
}

function readContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = "choices" in payload ? payload.choices : undefined;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
  const message = "message" in choices[0] ? choices[0].message : undefined;
  if (!message || typeof message !== "object" || !("content" in message)) return null;
  return typeof message.content === "string" && message.content.trim().length > 0
    ? message.content.trim()
    : null;
}

export function createAiClient(options: {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  fetchImpl?: typeof fetch;
}): CompletionClient {
  if (!options.apiKey) return createDisabledClient();
  return createOpenAiCompatibleClient({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl || "https://api.openai.com/v1",
    fetchImpl: options.fetchImpl,
  });
}
