import { NextRequest, NextResponse } from "next/server";
import { gonkaCall, MODELS } from "@/lib/gonka";

export const dynamic = "force-dynamic";

interface CacheEntry {
  signal: "上升" | "平稳" | "下滑";
  summary: string;
  requestId: string;
  model: string;
  cachedAt: number;
}

// In-memory cache (per server instance / lambda cold start). Good enough for a
// hackathon demo — avoids re-scraping + re-summarizing on repeated clicks.
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

async function searchDuckDuckGo(query: string): Promise<string[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`DuckDuckGo search failed: HTTP ${res.status}`);
  const html = await res.text();

  // Extract snippet text from result blocks. DuckDuckGo HTML endpoint markup:
  // <a class="result__snippet">...</a> — fall back to a generic strip if the
  // markup shifts, since this is a best-effort public search, not a stable API.
  const snippets: string[] = [];
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = snippetRegex.exec(html)) && snippets.length < 6) {
    const text = match[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, " ")
      .trim();
    if (text) snippets.push(text);
  }
  return snippets;
}

// DuckDuckGo's HTML endpoint bot-challenges datacenter IPs (HTTP 202, zero
// results) — fall back to the keyless Wikipedia search API so the demo still
// produces evidence when deployed on Vercel.
async function searchWikipedia(query: string): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;
  const res = await fetch(url, {
    headers: { "User-Agent": "WC2030Scout/1.0 (hackathon demo)" },
  });
  if (!res.ok) throw new Error(`Wikipedia search failed: HTTP ${res.status}`);
  const json = (await res.json()) as {
    query?: { search?: { title: string; snippet: string }[] };
  };
  return (json.query?.search ?? []).map(
    (r) => `${r.title}: ${r.snippet.replace(/<[^>]+>/g, "")}`,
  );
}

async function searchNews(query: string, fallbackQuery: string): Promise<string[]> {
  try {
    const ddg = await searchDuckDuckGo(query);
    if (ddg.length > 0) return ddg;
  } catch {
    // fall through to Wikipedia
  }
  return searchWikipedia(fallbackQuery);
}

export async function GET(req: NextRequest) {
  const player = req.nextUrl.searchParams.get("player")?.trim();
  if (!player) {
    return NextResponse.json({ error: "Missing ?player= query param" }, { status: 400 });
  }

  const cacheKey = player.toLowerCase();
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached);
  }

  if (!process.env.GONKA_API_KEY) {
    return NextResponse.json(
      { error: "GONKA_API_KEY 未配置，无法生成动态摘要" },
      { status: 503 },
    );
  }

  let snippets: string[];
  try {
    snippets = await searchNews(`${player} football news 2026`, player);
  } catch (err) {
    return NextResponse.json(
      { error: `搜索失败: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  if (snippets.length === 0) {
    return NextResponse.json(
      { error: "未找到相关公开搜索结果" },
      { status: 404 },
    );
  }

  const prompt = `以下是关于足球运动员「${player}」的近期公开搜索结果摘要（DuckDuckGo）：

${snippets.map((s, i) => `${i + 1}. ${s}`).join("\n")}

请基于以上信息，用中文简要总结该球员近期状态与动态（100字以内），并判断信号：
"上升"（状态/关注度上升）、"平稳"（无明显变化）、"下滑"（状态/关注度下降）。

只输出如下 JSON（不要输出其他内容）：
{"signal": "上升|平稳|下滑", "summary": "<中文摘要>"}`;

  let result;
  try {
    result = await gonkaCall(MODELS.KIMI, [{ role: "user", content: prompt }], {
      maxTokens: 300,
      temperature: 0.4,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Gonka 调用失败: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  let parsed: { signal: string; summary: string } | null = null;
  try {
    const cleaned = result.output
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = { signal: "平稳", summary: result.output.slice(0, 200) };
  }

  const signal: CacheEntry["signal"] = ["上升", "平稳", "下滑"].includes(parsed?.signal ?? "")
    ? (parsed!.signal as CacheEntry["signal"])
    : "平稳";

  const entry: CacheEntry = {
    signal,
    summary: parsed?.summary ?? "暂无摘要",
    requestId: result.requestId,
    model: result.model,
    cachedAt: Date.now(),
  };
  CACHE.set(cacheKey, entry);

  return NextResponse.json(entry);
}
