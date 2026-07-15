#!/usr/bin/env tsx
/**
 * WC2030 Scout — player enrichment batch script.
 *
 * For every player in data/squads.json, produces a data/enrichment.json entry
 * with:
 *   - photo + a short English bio sentence, from the Wikipedia REST summary
 *     API (https://en.wikipedia.org/api/rest_v1/page/summary/<title>).
 *   - Chinese common name, Chinese bio, former clubs, honours — from Gonka
 *     (Kimi), batched one call per team (whole 26-player roster at once).
 *
 * Usage:
 *   npx tsx scripts/enrich.ts                # all teams, resumable
 *   npx tsx scripts/enrich.ts --team ARG      # only Argentina
 *   npx tsx scripts/enrich.ts --team ARG,FRA  # multiple teams
 *
 * Resume: players already present in enrichment.json are skipped for BOTH
 * the Wikipedia lookup and the Gonka batch (a team's Gonka call is skipped
 * only if every one of its players already has zh data), so the script is
 * safe to re-run after interruption or rate-limiting.
 *
 * Network notes:
 *   - Wikipedia calls are sequential, ~3 req/s, tolerate 404s/failures
 *     (photo/bio just come back null — never fatal).
 *   - Gonka calls reuse lib/gonka.ts; on 429 the caller should wait ~60s and
 *     re-run (gonkaCall already retries 429/5xx internally with backoff, but
 *     if the whole run gets rate-limited, re-running the script picks up
 *     where it left off).
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { gonkaCall, MODELS } from "../lib/gonka";
import { slugify } from "../lib/slug";
import type { Player, SquadsData, Team, PlayerEnrichment, EnrichmentData } from "../lib/types";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config(); // fallback to .env

const DATA_DIR = path.join(process.cwd(), "data");
const SQUADS_PATH = path.join(DATA_DIR, "squads.json");
const ENRICHMENT_PATH = path.join(DATA_DIR, "enrichment.json");

const WIKI_DELAY_MS = 340; // ~3 req/s
const GONKA_DELAY_MS = 800;

function parseArgs(): { teams: string[] | null } {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--team");
  if (idx === -1) return { teams: null };
  const val = args[idx + 1];
  if (!val) return { teams: null };
  return { teams: val.split(",").map((s) => s.trim().toUpperCase()) };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadExisting(): EnrichmentData {
  if (!fs.existsSync(ENRICHMENT_PATH)) {
    return { generatedAt: new Date().toISOString(), players: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(ENRICHMENT_PATH, "utf-8")) as EnrichmentData;
  } catch {
    console.warn("⚠️  enrichment.json unreadable, starting fresh");
    return { generatedAt: new Date().toISOString(), players: [] };
  }
}

function save(data: EnrichmentData) {
  data.generatedAt = new Date().toISOString();
  fs.writeFileSync(ENRICHMENT_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function displayName(name: string): string {
  return name.replace(/\s*\(captain\)\s*$/i, "").trim();
}

interface WikiResult {
  photo: string | null;
  bioEn: string | null;
}

async function fetchWikiSummary(title: string): Promise<{ status: number; json: any } | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, "_"),
  )}`;
  try {
    // -4 forced elsewhere isn't available via fetch; rely on default resolution.
    const res = await fetch(url, { headers: { "User-Agent": "wc2030-scout/1.0 (hackathon project)" } });
    if (res.status === 404) return { status: 404, json: null };
    if (!res.ok) return { status: res.status, json: null };
    const json = await res.json();
    return { status: res.status, json };
  } catch (err) {
    console.error(`  ✗ Wikipedia fetch failed for "${title}":`, (err as Error).message);
    return null;
  }
}

async function lookupWiki(name: string): Promise<WikiResult> {
  const clean = displayName(name);
  let result = await fetchWikiSummary(clean);
  if (!result || result.status === 404 || !result.json || result.json.type === "disambiguation") {
    await sleep(WIKI_DELAY_MS);
    result = await fetchWikiSummary(`${clean} (footballer)`);
  }
  if (!result || !result.json || result.json.type === "disambiguation") {
    return { photo: null, bioEn: null };
  }
  const photo: string | null = result.json.thumbnail?.source ?? null;
  const bioEn: string | null = result.json.extract ?? null;
  return { photo, bioEn };
}

function buildTeamPrompt(team: Team): string {
  const roster = team.players
    .map((p) => `- ${displayName(p.name)}（位置${p.position}，${p.club}，${p.league}）`)
    .join("\n");
  return `请为下面这份${team.country}国家队球员名单，逐一给出中文常用译名与简介，严格按照下面 JSON 数组格式输出（不要输出其他任何文字或 Markdown 代码块标记，name 字段必须与输入完全一致，保持顺序，不要遗漏任何一名球员）：

球员名单：
${roster}

输出格式：
[
  {"name": "<与输入完全一致的英文姓名>", "nameZh": "<中文媒体常用译名，如 姆巴佩、梅西；不确定则给出你认为最合理的音译>", "bioZh": "<40字以内中文简介>", "formerClubs": ["<历任主要俱乐部，按时间顺序，不含现效力俱乐部，不确定则空数组>"], "honours": ["<最多3条主要荣誉，不确定则空数组>"]}
]

请保持严谨：不确定的信息宁可留空数组，也不要编造。只输出 JSON 数组本身。`;
}

interface GonkaPlayerFields {
  name: string;
  nameZh: string;
  bioZh: string;
  formerClubs: string[];
  honours: string[];
}

function safeParseJson<T>(raw: string): T | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/(\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[1]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Match Gonka's returned name back to a roster player, tolerating minor
 *  whitespace/formatting differences the model might introduce. */
function matchByName(rosterNames: string[], candidate: string): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const target = norm(candidate);
  return rosterNames.find((n) => norm(n) === target) ?? null;
}

async function fetchTeamZhFields(team: Team): Promise<Map<string, GonkaPlayerFields> | null> {
  const prompt = buildTeamPrompt(team);
  let res;
  try {
    res = await gonkaCall(
      MODELS.KIMI,
      [
        {
          role: "system",
          content:
            "你是一名足球领域的中文体育编辑，熟悉各国国家队球员的中文通用译名与履历。只输出严格 JSON，不要输出任何多余文字。",
        },
        { role: "user", content: prompt },
      ],
      { maxTokens: 4000, temperature: 0.3 },
    );
  } catch (err) {
    console.error(`  ✗ Gonka call failed for ${team.code}:`, (err as Error).message);
    return null;
  }
  const parsed = safeParseJson<GonkaPlayerFields[]>(res.output);
  if (!parsed || !Array.isArray(parsed)) {
    console.error(`  ✗ Could not parse Gonka zh fields for ${team.code}`);
    return null;
  }
  const rosterNames = team.players.map((p) => displayName(p.name));
  const map = new Map<string, GonkaPlayerFields>();
  for (const entry of parsed) {
    const matched = matchByName(rosterNames, entry.name ?? "");
    if (matched) map.set(matched, entry);
  }
  return map;
}

async function main() {
  if (!process.env.GONKA_API_KEY) {
    console.error(
      "⚠️  GONKA_API_KEY is not set. Skipping enrich run.\n" +
        "   Set it in .env.local and re-run:\n" +
        "     npx tsx scripts/enrich.ts",
    );
    process.exit(0);
  }

  const { teams: teamFilter } = parseArgs();
  const squads: SquadsData = JSON.parse(fs.readFileSync(SQUADS_PATH, "utf-8"));
  const teams = teamFilter
    ? squads.teams.filter((t) => teamFilter.includes(t.code.toUpperCase()))
    : squads.teams;

  if (teams.length === 0) {
    console.error(`No teams matched filter: ${teamFilter?.join(",")}`);
    process.exit(1);
  }

  const enrichment = loadExisting();
  const bySlug = new Map(enrichment.players.map((e) => [`${e.team}::${e.slug}`, e]));

  let photoHits = 0;
  let bioHits = 0;
  let zhHits = 0;
  let total = 0;

  for (const team of teams) {
    console.log(`\n=== ${team.country} (${team.code}) ===`);

    // Only call Gonka for this team if at least one player is missing zh data.
    const needsZh = team.players.some((p) => {
      const existing = bySlug.get(`${team.code}::${slugify(p.name)}`);
      return !existing || !existing.nameZh;
    });
    let zhMap: Map<string, GonkaPlayerFields> | null = null;
    if (needsZh) {
      console.log(`  ⏳ Gonka zh batch for ${team.code}...`);
      zhMap = await fetchTeamZhFields(team);
      if (zhMap) console.log(`  ✓ Gonka returned zh data for ${zhMap.size}/${team.players.length} players`);
      await sleep(GONKA_DELAY_MS);
    } else {
      console.log(`  ⏭  zh data for ${team.code} already complete, skipping Gonka`);
    }

    for (const player of team.players) {
      total++;
      const slug = slugify(player.name);
      const key = `${team.code}::${slug}`;
      const existing = bySlug.get(key);
      const clean = displayName(player.name);

      let photo = existing?.photo ?? null;
      let bioEn = existing?.bio?.en ?? null;
      if (!existing || (photo === null && bioEn === null)) {
        console.log(`  ⏳ wiki: ${clean}...`);
        const wiki = await lookupWiki(player.name);
        photo = wiki.photo;
        bioEn = wiki.bioEn;
        await sleep(WIKI_DELAY_MS);
      }
      if (photo) photoHits++;
      if (bioEn) bioHits++;

      const zhFields = zhMap?.get(clean);
      const nameZh = zhFields?.nameZh ?? existing?.nameZh ?? null;
      const bioZh = zhFields?.bioZh ?? existing?.bio?.zh ?? null;
      const formerClubs = zhFields?.formerClubs ?? existing?.career?.formerClubs ?? [];
      const honours = zhFields?.honours ?? existing?.career?.honours ?? [];
      if (nameZh) zhHits++;

      const entry: PlayerEnrichment = {
        slug,
        team: team.code,
        nameEn: clean,
        nameZh,
        photo,
        bio: { zh: bioZh, en: bioEn },
        career: {
          formerClubs,
          nationalTeam: { caps: player.caps, goals: player.goals },
          honours,
        },
      };
      bySlug.set(key, entry);
      console.log(
        `  ✓ ${clean}: photo=${photo ? "yes" : "no"} zh=${nameZh ?? "-"} clubs=${formerClubs.length}`,
      );
    }

    enrichment.players = Array.from(bySlug.values());
    save(enrichment);
  }

  enrichment.players = Array.from(bySlug.values());
  save(enrichment);

  console.log(
    `\n✅ Done. ${enrichment.players.length} players in enrichment.json ` +
      `(this run: ${total} processed, ${photoHits} photos, ${bioHits} en bios, ${zhHits} zh names)`,
  );
}

main().catch((err) => {
  console.error("Fatal error in enrich script:", err);
  process.exit(1);
});
