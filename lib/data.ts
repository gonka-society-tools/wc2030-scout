import fs from "node:fs";
import path from "node:path";
import type {
  PredictionsData,
  SquadsData,
  PlayerPrediction,
  TeamPredictions,
  EnrichmentData,
  PlayerEnrichment,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

let squadsCache: SquadsData | null = null;
let predictionsCache: PredictionsData | null = null;
let enrichmentCache: EnrichmentData | null = null;

export function loadSquads(): SquadsData {
  if (squadsCache) return squadsCache;
  const raw = fs.readFileSync(path.join(DATA_DIR, "squads.json"), "utf-8");
  squadsCache = JSON.parse(raw) as SquadsData;
  return squadsCache;
}

/**
 * Loads predictions.json if it exists (real Gonka run output), otherwise falls
 * back to predictions.sample.json (mock data) so the frontend always renders.
 */
export function loadPredictions(): PredictionsData {
  if (predictionsCache) return predictionsCache;
  const realPath = path.join(DATA_DIR, "predictions.json");
  const samplePath = path.join(DATA_DIR, "predictions.sample.json");
  const target = fs.existsSync(realPath) ? realPath : samplePath;
  if (!fs.existsSync(target)) {
    predictionsCache = { generatedAt: "", players: [], teams: [] };
    return predictionsCache;
  }
  const raw = fs.readFileSync(target, "utf-8");
  predictionsCache = JSON.parse(raw) as PredictionsData;
  return predictionsCache;
}

export function isUsingSampleData(): boolean {
  return !fs.existsSync(path.join(DATA_DIR, "predictions.json"));
}

/**
 * Loads data/enrichment.json (Wikipedia photo/bio + Gonka zh names/career),
 * produced by scripts/enrich.ts. Optional — the UI degrades gracefully
 * (flag-emoji fallback, no zh name/bio) when it hasn't been generated yet.
 */
export function loadEnrichment(): EnrichmentData {
  if (enrichmentCache) return enrichmentCache;
  const target = path.join(DATA_DIR, "enrichment.json");
  if (!fs.existsSync(target)) {
    enrichmentCache = { generatedAt: "", players: [] };
    return enrichmentCache;
  }
  const raw = fs.readFileSync(target, "utf-8");
  enrichmentCache = JSON.parse(raw) as EnrichmentData;
  return enrichmentCache;
}

export function getPlayerEnrichment(
  teamCode: string,
  slug: string,
): PlayerEnrichment | undefined {
  const { players } = loadEnrichment();
  return players.find((p) => p.team.toLowerCase() === teamCode.toLowerCase() && p.slug === slug);
}

export function getTeamByCode(code: string) {
  const squads = loadSquads();
  return squads.teams.find((t) => t.code.toLowerCase() === code.toLowerCase());
}

export function getPlayerPrediction(
  playerName: string,
  teamCode: string,
): PlayerPrediction | undefined {
  const preds = loadPredictions();
  return preds.players.find(
    (p) => p.name === playerName && p.team.toLowerCase() === teamCode.toLowerCase(),
  );
}

export function getTeamNewcomers(teamCode: string): TeamPredictions | undefined {
  const preds = loadPredictions();
  return preds.teams.find((t) => t.team.toLowerCase() === teamCode.toLowerCase());
}
