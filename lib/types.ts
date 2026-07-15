// Shared types for squads.json + predictions.json

export interface Player {
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  birthYear: number;
  club: string;
  league: string;
  caps: number;
  goals: number;
}

export interface Team {
  country: string;
  code: string;
  players: Player[];
}

export interface SquadsData {
  generatedAt: string;
  source: string;
  teams: Team[];
}

/** One model's individual prediction for a player. */
export interface ModelPrediction {
  probability2030: number; // 0-100
  reasoning: string;
  requestId: string;
  model: string;
}

/** Combined per-player prediction record stored in predictions.json. */
export interface PlayerPrediction {
  name: string;
  team: string; // team code
  kimi: ModelPrediction;
  minimax: ModelPrediction;
  mean: number;
  divergence: number; // abs(kimi - minimax)
}

/** A model-inferred 2030 newcomer candidate for a team. */
export interface Newcomer {
  name: string;
  position: Player["position"];
  note: string; // short reasoning, always labeled 模型推断
  requestId: string;
  model: string;
}

export interface TeamPredictions {
  team: string; // team code
  newcomers: Newcomer[];
}

export interface PredictionsData {
  generatedAt: string;
  players: PlayerPrediction[];
  teams: TeamPredictions[];
}

/** One enriched player record — Wikipedia photo/bio + Gonka zh names/bio/career. */
export interface PlayerEnrichment {
  slug: string;
  team: string; // team code
  nameEn: string;
  nameZh: string | null;
  /** Hotlinkable upload.wikimedia.org thumbnail URL, or null if not found. */
  photo: string | null;
  bio: {
    zh: string | null;
    en: string | null;
  };
  career: {
    formerClubs: string[];
    nationalTeam: { caps: number; goals: number };
    honours?: string[];
  };
}

export interface EnrichmentData {
  generatedAt: string;
  players: PlayerEnrichment[];
}
