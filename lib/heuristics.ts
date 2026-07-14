import type { Player } from "./types";

/** Rough league strength tiers (1-10) for heuristic scoring — not authoritative. */
const LEAGUE_TIER: Record<string, number> = {
  "Premier League": 10,
  "La Liga": 9.5,
  "Bundesliga": 9,
  "Serie A": 8.5,
  "Ligue 1": 8,
  "Saudi Pro League": 6,
  "MLS": 6,
  "Liga Portugal": 7,
  "Eredivisie": 7,
  "Süper Lig": 6,
  "J1 League": 5.5,
  "Liga Profesional Argentina": 5.5,
  "Brasileirão": 6,
  "Botola Pro": 4.5,
};

export function leagueTier(league: string): number {
  return LEAGUE_TIER[league] ?? 5;
}

/** Typical "usable career end" age by position — used for age-longevity heuristics. */
const POSITION_LONGEVITY: Record<Player["position"], number> = {
  GK: 38,
  DF: 35,
  MF: 34,
  FW: 33,
};

export function ageIn2030(birthYear: number): number {
  return 2030 - birthYear;
}

/**
 * Five heuristic 0-100 dims used for the player radar chart.
 * These are NOT model outputs — computed locally from squads.json fields
 * so the radar renders even without Gonka calls.
 */
export interface RadarDims {
  ageScore: number; // likelihood of still being fit/selected in 2030 by age
  leagueScore: number; // current club league level
  capsScore: number; // international experience
  outputScore: number; // goals contribution relative to position/caps
  trendScore: number; // proxy for career trajectory (younger + high caps/season = rising)
}

export function computeRadarDims(p: Player): RadarDims {
  const age2030 = ageIn2030(p.birthYear);
  const longevity = POSITION_LONGEVITY[p.position];
  const ageGap = longevity - age2030;
  // ageScore: 100 if comfortably within longevity window, decays outside it
  const ageScore = clamp(50 + ageGap * 9, 3, 100);

  const leagueScore = clamp(leagueTier(p.league) * 10, 5, 100);

  const capsScore = clamp(Math.sqrt(p.caps) * 14, 3, 100);

  const goalRate = p.caps > 0 ? p.goals / p.caps : 0;
  const posMultiplier = { FW: 1, MF: 1.6, DF: 3, GK: 5 }[p.position];
  const outputScore = clamp(goalRate * posMultiplier * 260, 5, 100);

  // trend: younger players with meaningful caps already trend up; veterans trend down
  const currentAge = 2026 - p.birthYear;
  const youthBonus = clamp((29 - currentAge) * 4, -40, 40);
  const experienceFactor = clamp(Math.sqrt(p.caps) * 6, 0, 40);
  const trendScore = clamp(50 + youthBonus + experienceFactor / 2 - (currentAge > 32 ? (currentAge - 32) * 10 : 0), 3, 100);

  return {
    ageScore: Math.round(ageScore),
    leagueScore: Math.round(leagueScore),
    capsScore: Math.round(capsScore),
    outputScore: Math.round(outputScore),
    trendScore: Math.round(trendScore),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
