/** Team code (as used in squads.json) -> flag emoji + ISO alpha-2 for display. */
export const FLAGS: Record<string, string> = {
  ARG: "🇦🇷",
  FRA: "🇫🇷",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  BRA: "🇧🇷",
  ESP: "🇪🇸",
  GER: "🇩🇪",
  JPN: "🇯🇵",
  MAR: "🇲🇦",
  POR: "🇵🇹",
  NED: "🇳🇱",
};

export function flagFor(code: string): string {
  return FLAGS[code.toUpperCase()] ?? "🏳️";
}

/** Country name -> zh label for a nicer bilingual home grid (best-effort, optional). */
export const COUNTRY_ZH: Record<string, string> = {
  Argentina: "阿根廷",
  France: "法国",
  England: "英格兰",
  Brazil: "巴西",
  Spain: "西班牙",
  Germany: "德国",
  Japan: "日本",
  Morocco: "摩洛哥",
  Portugal: "葡萄牙",
  Netherlands: "荷兰",
};
