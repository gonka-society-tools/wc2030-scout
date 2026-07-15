import { loadSquads, loadPredictions, loadEnrichment } from "./data";
import { computeRadarDims, type RadarDims } from "./heuristics";
import { slugify } from "./slug";
import type { Player, PlayerPrediction, Newcomer, PlayerEnrichment } from "./types";

export interface RosterEntry {
  player: Player;
  /** URL-safe slug for this player, used in /team/[code]/[player] routes. */
  slug: string;
  prediction: PlayerPrediction | null;
  /** Displayable 2030 probability: real model mean if available, else a heuristic fallback. */
  displayProbability: number;
  isHeuristicFallback: boolean;
  radar: RadarDims;
  /** Wikipedia photo/bio + Gonka zh name/career, if scripts/enrich.ts has been run. */
  enrichment: PlayerEnrichment | null;
}

/** Cheap fallback score (0-100) derived purely from local heuristics, used when
 *  no Gonka prediction exists yet for a player, so the UI never shows an empty state. */
function heuristicFallbackProbability(radar: RadarDims): number {
  return Math.round(radar.ageScore * 0.5 + radar.trendScore * 0.3 + radar.leagueScore * 0.2);
}

export function getRoster(teamCode: string): RosterEntry[] {
  const squads = loadSquads();
  const predictions = loadPredictions();
  const enrichment = loadEnrichment();
  const team = squads.teams.find((t) => t.code.toLowerCase() === teamCode.toLowerCase());
  if (!team) return [];

  return team.players.map((player) => {
    const prediction =
      predictions.players.find(
        (p) => p.name === player.name && p.team.toLowerCase() === teamCode.toLowerCase(),
      ) ?? null;
    const radar = computeRadarDims(player);
    const displayProbability = prediction ? prediction.mean : heuristicFallbackProbability(radar);
    const slug = slugify(player.name);
    const playerEnrichment =
      enrichment.players.find(
        (e) => e.team.toLowerCase() === teamCode.toLowerCase() && e.slug === slug,
      ) ?? null;
    return {
      player,
      slug,
      prediction,
      displayProbability,
      isHeuristicFallback: !prediction,
      radar,
      enrichment: playerEnrichment,
    };
  });
}

export function getRosterSorted(teamCode: string): RosterEntry[] {
  return [...getRoster(teamCode)].sort((a, b) => b.displayProbability - a.displayProbability);
}

const LINEUP_SLOTS: { position: Player["position"]; count: number }[] = [
  { position: "GK", count: 1 },
  { position: "DF", count: 4 },
  { position: "MF", count: 3 },
  { position: "FW", count: 3 },
];

/** Best-XI-style "2030 predicted lineup": top N per position by display probability. */
export function getPredictedLineup(teamCode: string): Record<Player["position"], RosterEntry[]> {
  const roster = getRosterSorted(teamCode);
  const result: Record<Player["position"], RosterEntry[]> = { GK: [], DF: [], MF: [], FW: [] };
  for (const slot of LINEUP_SLOTS) {
    result[slot.position] = roster
      .filter((r) => r.player.position === slot.position)
      .slice(0, slot.count);
  }
  return result;
}

export function getNewcomers(teamCode: string): Newcomer[] {
  const predictions = loadPredictions();
  return (
    predictions.teams.find((t) => t.team.toLowerCase() === teamCode.toLowerCase())?.newcomers ?? []
  );
}

export function getPlayerEntry(teamCode: string, playerName: string): RosterEntry | null {
  return getRoster(teamCode).find((r) => r.player.name === playerName) ?? null;
}

/** Look up a player by their route slug (see lib/slug.ts) within a team. */
export function getPlayerEntryBySlug(teamCode: string, slug: string): RosterEntry | null {
  return getRoster(teamCode).find((r) => r.slug === slug) ?? null;
}
