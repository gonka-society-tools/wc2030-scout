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
