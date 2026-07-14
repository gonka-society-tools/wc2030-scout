/**
 * Gonka shared client — hackathon 强制项: every call returns the Gonka Request ID.
 *
 * Usage (Next.js API route / node):
 *   import { gonkaCall, MODELS } from "./client";
 *   const { output, requestId, model } = await gonkaCall(MODELS.KIMI, [
 *     { role: "user", content: "hello" },
 *   ]);
 *
 * Env:
 *   GONKA_API_KEY          required (never commit)
 *   GONKA_OPENAI_BASE_URL  optional, default https://api.gonkarouter.io/v1
 */

export const MODELS = {
  KIMI: "moonshotai/Kimi-K2.6",
  MINIMAX: "MiniMaxAI/MiniMax-M2.7",
  QWEN: "Qwen/Qwen3-235B-A22B-Instruct-2507-FP8",
} as const;

export type GonkaModel = (typeof MODELS)[keyof typeof MODELS];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GonkaResult {
  output: string;
  /** Gonka Request ID — response body `id` (no dedicated header). Show in UI. */
  requestId: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const BASE_URL =
  process.env.GONKA_OPENAI_BASE_URL ?? "https://api.gonkarouter.io/v1";

export async function gonkaCall(
  model: GonkaModel | string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; retries?: number } = {},
): Promise<GonkaResult> {
  const key = process.env.GONKA_API_KEY;
  if (!key) throw new Error("GONKA_API_KEY is not set");

  const { maxTokens = 2048, temperature = 0.3, retries = 2 } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature, messages }),
      });
      if (!res.ok) {
        const body = await res.text();
        // 429/5xx: retry with backoff; 4xx others: fail fast
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          lastErr = new Error(`Gonka ${res.status}: ${body.slice(0, 300)}`);
          continue;
        }
        throw new Error(`Gonka ${res.status}: ${body.slice(0, 300)}`);
      }
      const json = await res.json();
      // MiniMax-M2.7 emits <think>…</think> reasoning blocks before the answer —
      // strip them so callers can parse JSON output directly. Budget maxTokens
      // generously (>=1500) for MiniMax: the think block consumes output tokens.
      const rawContent: string = json.choices?.[0]?.message?.content ?? "";
      const output = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      return {
        output,
        requestId: json.id ?? "unknown",
        model: json.model ?? String(model),
        usage: json.usage,
      };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Convenience: call the same prompt on two models for cross-verification (加分项). */
export async function gonkaCrossCheck(
  messages: ChatMessage[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<[GonkaResult, GonkaResult]> {
  return Promise.all([
    gonkaCall(MODELS.KIMI, messages, opts),
    gonkaCall(MODELS.MINIMAX, messages, opts),
  ]) as Promise<[GonkaResult, GonkaResult]>;
}
