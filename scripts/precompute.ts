#!/usr/bin/env tsx
/**
 * WC2030 Scout — batch precompute script.
 *
 * For every player in data/squads.json, asks two Gonka models (Kimi K2.6 and
 * MiniMax M2.7) independently to estimate the probability (0-100) that the
 * player is still part of their national team's 2030 World Cup squad, plus a
 * short reasoning. Both results + requestIds are stored in data/predictions.json
 * along with mean/divergence. Also asks Kimi, per team, for 3 likely 2030
 * newcomers (explicitly labeled model inference, not a scouting database).
 *
 * Usage:
 *   npx tsx scripts/precompute.ts                # all teams, resumable
 *   npx tsx scripts/precompute.ts --team ARG      # only Argentina
 *   npx tsx scripts/precompute.ts --team ARG,FRA  # multiple teams
 *
 * Requires GONKA_API_KEY in env (.env.local is auto-loaded). Exits gracefully
 * (no crash, clear message) if the key is missing — this lets CI/build run
 * without secrets, relying on predictions.sample.json for the frontend.
 *
 * Resume: players already present in predictions.json are skipped, so the
 * script can be re-run after interruption or rate-limiting without redoing
 * completed work.
 *
 * Rate limiting: calls are sequential (not parallel) with a small delay
 * between each player to stay friendly to the Gonka API.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { gonkaCall, MODELS, type ChatMessage } from "../lib/gonka";
import type {
  Player,
  SquadsData,
  PredictionsData,
  PlayerPrediction,
  ModelPrediction,
  Newcomer,
  Team,
} from "../lib/types";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config(); // fallback to .env

const DATA_DIR = path.join(process.cwd(), "data");
const SQUADS_PATH = path.join(DATA_DIR, "squads.json");
const PREDICTIONS_PATH = path.join(DATA_DIR, "predictions.json");

const DELAY_MS = 800; // sequential, rate-limit friendly

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

function loadExistingPredictions(): PredictionsData {
  if (!fs.existsSync(PREDICTIONS_PATH)) {
    return { generatedAt: new Date().toISOString(), players: [], teams: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(PREDICTIONS_PATH, "utf-8")) as PredictionsData;
  } catch {
    console.warn("⚠️  predictions.json unreadable, starting fresh");
    return { generatedAt: new Date().toISOString(), players: [], teams: [] };
  }
}

function savePredictions(data: PredictionsData) {
  data.generatedAt = new Date().toISOString();
  fs.writeFileSync(PREDICTIONS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function buildPlayerPrompt(p: Player, teamCountry: string): ChatMessage[] {
  const age2030 = 2030 - p.birthYear;
  return [
    {
      role: "system",
      content:
        "你是一名足球数据分析助手，基于公开球员信息进行客观、审慎的概率估计。" +
        "只输出严格的 JSON，不要输出任何多余文字或 Markdown 代码块标记。",
    },
    {
      role: "user",
      content: `请评估以下球员在2030年世界杯（2030 FIFA World Cup）时，仍然入选${teamCountry}国家队大名单的概率。

球员信息：
- 姓名：${p.name}
- 位置：${p.position}
- 出生年份：${p.birthYear}（2030年时年龄约 ${age2030} 岁）
- 现效力俱乐部：${p.club}
- 所在联赛：${p.league}
- 国家队出场次数：${p.caps}
- 国家队进球数：${p.goals}

请综合考虑：该位置球员的常见职业生涯长度（门将通常比前锋更长）、当前联赛/俱乐部水平、
国家队经验的深浅、以及2030年时的年龄是否仍处于该位置的竞技巅峰或合理下滑区间。

只输出如下 JSON 格式（不要输出其他任何内容）：
{"probability2030": <0到100的整数>, "reasoning": "<80字以内的中文简要理由>"}`,
    },
  ];
}

function buildNewcomerPrompt(team: Team): ChatMessage[] {
  const rosterNames = team.players.map((p) => p.name).join("、");
  return [
    {
      role: "system",
      content:
        "你是一名足球青训与国家队选拔趋势分析助手。你的回答是基于公开信息与合理推断的" +
        "模型推测，不是确定性事实，请明确这一点。只输出严格 JSON，不要输出多余文字。",
    },
    {
      role: "user",
      content: `请推测${team.country}国家队到2030年世界杯时，有可能新入选大名单的3名新星球员
（即当前不在下面这份2026年大名单中的年轻球员/潜力新星）。

2026年大名单（供参考，避免重复）：${rosterNames}

只输出如下 JSON 数组格式（不要输出其他任何内容），position 取值必须是 GK/DF/MF/FW 之一：
[
  {"name": "<球员姓名>", "position": "<GK|DF|MF|FW>", "note": "<50字以内推断理由，中文>"},
  {"name": "...", "position": "...", "note": "..."},
  {"name": "...", "position": "...", "note": "..."}
]`,
    },
  ];
}

function safeParseJson<T>(raw: string): T | null {
  // strip common markdown code-fence wrapping
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // try to extract the first {...} or [...] block
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
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

async function predictPlayer(p: Player, teamCode: string, teamCountry: string): Promise<PlayerPrediction | null> {
  const messages = buildPlayerPrompt(p, teamCountry);

  // call + parse with one retry at a larger token budget (MiniMax <think> blocks
  // can overrun the first budget and truncate the JSON)
  const callAndParse = async (model: string, budgets: number[]) => {
    for (const maxTokens of budgets) {
      let res;
      try {
        res = await gonkaCall(model, messages, { maxTokens, temperature: 0.4 });
      } catch (err) {
        console.error(`  ✗ ${model} failed for ${p.name}:`, (err as Error).message);
        return null;
      }
      const parsed = safeParseJson<{ probability2030: number; reasoning: string }>(res.output);
      if (parsed) return { res, parsed };
      await sleep(DELAY_MS);
    }
    console.error(`  ✗ Could not parse ${model} output for ${p.name}`);
    return null;
  };

  const kimiOut = await callAndParse(MODELS.KIMI, [600, 1200]);
  if (!kimiOut) return null;
  await sleep(DELAY_MS);
  const minimaxOut = await callAndParse(MODELS.MINIMAX, [2000, 4000]);
  if (!minimaxOut) return null;

  const { res: kimiRes, parsed: kimiParsed } = kimiOut;
  const { res: minimaxRes, parsed: minimaxParsed } = minimaxOut;

  const kimi: ModelPrediction = {
    probability2030: clampProb(kimiParsed.probability2030),
    reasoning: kimiParsed.reasoning ?? "",
    requestId: kimiRes.requestId,
    model: kimiRes.model,
  };
  const minimax: ModelPrediction = {
    probability2030: clampProb(minimaxParsed.probability2030),
    reasoning: minimaxParsed.reasoning ?? "",
    requestId: minimaxRes.requestId,
    model: minimaxRes.model,
  };

  const mean = Math.round((kimi.probability2030 + minimax.probability2030) / 2);
  const divergence = Math.abs(kimi.probability2030 - minimax.probability2030);

  return { name: p.name, team: teamCode, kimi, minimax, mean, divergence };
}

function clampProb(v: number): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}

async function predictNewcomers(team: Team): Promise<Newcomer[] | null> {
  const messages = buildNewcomerPrompt(team);
  let res;
  try {
    res = await gonkaCall(MODELS.KIMI, messages, { maxTokens: 500, temperature: 0.7 });
  } catch (err) {
    console.error(`  ✗ Newcomer prediction failed for ${team.code}:`, (err as Error).message);
    return null;
  }
  const parsed = safeParseJson<Array<{ name: string; position: string; note: string }>>(res.output);
  if (!parsed || !Array.isArray(parsed)) {
    console.error(`  ✗ Could not parse newcomers for ${team.code}`);
    return null;
  }
  return parsed.slice(0, 3).map((n) => ({
    name: n.name,
    position: (["GK", "DF", "MF", "FW"].includes(n.position) ? n.position : "MF") as Player["position"],
    note: `[模型推断] ${n.note ?? ""}`,
    requestId: res!.requestId,
    model: res!.model,
  }));
}

async function main() {
  if (!process.env.GONKA_API_KEY) {
    console.error(
      "⚠️  GONKA_API_KEY is not set. Skipping precompute run.\n" +
        "   Set it in .env.local (see .env.example) and re-run:\n" +
        "     npx tsx scripts/precompute.ts\n" +
        "   The frontend will keep using data/predictions.sample.json until then.",
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

  const predictions = loadExistingPredictions();
  const existingPlayerKeys = new Set(predictions.players.map((p) => `${p.team}::${p.name}`));
  const existingTeamKeys = new Set(predictions.teams.map((t) => t.team));

  for (const team of teams) {
    console.log(`\n=== ${team.country} (${team.code}) ===`);

    for (const player of team.players) {
      const key = `${team.code}::${player.name}`;
      if (existingPlayerKeys.has(key)) {
        console.log(`  ⏭  ${player.name} (already predicted, skipping)`);
        continue;
      }
      console.log(`  ⏳ ${player.name}...`);
      const result = await predictPlayer(player, team.code, team.country);
      if (result) {
        predictions.players.push(result);
        existingPlayerKeys.add(key);
        savePredictions(predictions); // persist incrementally so progress survives interruption
        console.log(
          `  ✓ ${player.name}: Kimi=${result.kimi.probability2030} MiniMax=${result.minimax.probability2030} mean=${result.mean}`,
        );
      }
      await sleep(DELAY_MS);
    }

    if (!existingTeamKeys.has(team.code)) {
      console.log(`  ⏳ newcomers for ${team.code}...`);
      const newcomers = await predictNewcomers(team);
      if (newcomers) {
        predictions.teams.push({ team: team.code, newcomers });
        existingTeamKeys.add(team.code);
        savePredictions(predictions);
        console.log(`  ✓ ${newcomers.length} newcomers predicted for ${team.code}`);
      }
      await sleep(DELAY_MS);
    } else {
      console.log(`  ⏭  newcomers for ${team.code} already predicted, skipping`);
    }
  }

  savePredictions(predictions);
  console.log(`\n✅ Done. Wrote ${predictions.players.length} player predictions to ${PREDICTIONS_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error in precompute script:", err);
  process.exit(1);
});
