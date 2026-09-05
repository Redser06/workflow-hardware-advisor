import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Lovable AI Gateway provider for the AI SDK.
 * Server-only: the API key must never reach the browser.
 */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
    },
    // GPT-5.6 chat completions reject function tools unless reasoning is off,
    // and the AI SDK has no portable option for that flag, so set it on the body.
    fetch: async (input, init) => {
      if (init?.body && typeof init.body === "string") {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        body["reasoning_effort"] = "none";
        return fetch(input, { ...init, body: JSON.stringify(body) });
      }
      return fetch(input, init);
    },
  });
}

export const CHAT_MODEL = "openai/gpt-5.6-sol";
