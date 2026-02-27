const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const OPENROUTER_MODEL = "openai/gpt-oss-120b";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callOpenRouter(
  messages: ChatMessage[],
  options?: { maxTokens?: number; timeoutMs?: number },
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? 15000,
  );

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://aiugcgenerator.com",
        "X-Title": "AI UGC Generator",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        max_tokens: options?.maxTokens ?? 500,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${err}`);
    }

    const body = await res.json();
    return body.choices[0].message.content;
  } finally {
    clearTimeout(timeout);
  }
}
