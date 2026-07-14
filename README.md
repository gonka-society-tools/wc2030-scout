# WC2030 Scout

An open, public sports knowledge engine that predicts which players from the
**2026 FIFA World Cup** 26-man squads are likely to still be part of their
national team's **2030 FIFA World Cup** squad — built for the **AI³ Hackathon,
Gonka track**.

> ⚠️ **This is not a betting product.** Every probability shown is an AI
> model's subjective estimate based on public data (age, position longevity
> norms, club/league level, caps, goals). See `/methodology` in the app for
> the full disclaimer and process write-up.
> 数据截至 2026-07 · AI 推断仅供参考，非博彩建议。

## Features

- **Home** — grid of 10 national teams (flag, current vs. 2030 average squad age).
- **Team page** (`/team/[code]`) — full roster sorted by 2030 retention
  probability, a "2030 predicted lineup" (1 GK / 4 DF / 3 MF / 3 FW picked by
  highest probability per position), and 3 model-inferred "2030 newcomers" per
  team (clearly labeled 模型推断 / model inference, not scouted fact).
- **Player page** (`/team/[code]/[player]`) — five-dimension radar (age
  longevity, league level, caps, output, career trend — computed locally by
  heuristics, not a model call), both models' reasoning + Gonka Request IDs,
  and a "最新动态 / Latest Signal" button that live-searches DuckDuckGo and
  asks Kimi to summarize the player's recent trajectory (上升/平稳/下滑).
- **Methodology page** (`/methodology`) — data sources, prompt design, model
  process, betting disclaimer, iteration plan.
- **Gonka Request ID badge** — every live Gonka call (news summary) is
  accumulated in the fixed bottom-right badge; precomputed player predictions
  show their stored Request IDs inline in the player detail card.
- 中文为主 + English subtitles, dark "sporty" theme, mobile-friendly.

中文摘要：WC2030 Scout 是一个开放的公共体育知识引擎，基于 2026 世界杯 10 支球队
26 人大名单的公开数据，用 Gonka 上的 Kimi K2.6 与 MiniMax M2.7 双模型独立推断
每名球员在 2030 世界杯的留队概率，并交叉验证（均值 + 分歧度标记）。同时提供
2030 预测阵容、模型推断的潜在新星、球员雷达图、以及基于实时网页搜索的"最新动态"
摘要功能。全站包含醒目的非博彩免责声明。

## Install & Run

```bash
npm install
cp .env.example .env.local   # then fill in GONKA_API_KEY (optional — see below)
npm run dev                  # http://localhost:3000
```

```bash
npm run build && npm run start   # production build
```

The frontend works **without** `GONKA_API_KEY` — it reads
`data/predictions.json` if present, otherwise falls back to
`data/predictions.sample.json` (mock data for ~6 players so pages always
render). Live in-app features that need the key at runtime:

- `/api/news?player=...` (the "最新动态" button) — returns `503` with a clear
  error message if `GONKA_API_KEY` is missing.

## Precompute script

`scripts/precompute.ts` batch-generates `data/predictions.json` by calling
Gonka twice per player (Kimi K2.6 + MiniMax M2.7, independently) plus once per
team for 3 "2030 newcomer" candidates.

```bash
# requires GONKA_API_KEY in .env.local or the shell environment
npx tsx scripts/precompute.ts                # all 10 teams (260 players)
npx tsx scripts/precompute.ts --team ARG      # one team
npx tsx scripts/precompute.ts --team ARG,FRA  # multiple teams
```

- **Resumable**: players already present in `predictions.json` are skipped,
  so an interrupted run can just be re-launched.
- **Rate-limit friendly**: calls run sequentially (not in parallel) with an
  ~800ms delay between requests.
- **Graceful without a key**: exits cleanly (code 0) with an instructional
  message if `GONKA_API_KEY` is unset — safe to leave in CI/build pipelines.
- Writes progress incrementally after every player, so partial runs are not
  lost.

This script was **not run** as part of this build (no live key available at
build time) — `data/predictions.sample.json` stands in for the frontend.

## Architecture

```
app/
  page.tsx                       # home: team grid
  team/[code]/page.tsx           # team roster + 2030 lineup + newcomers
  team/[code]/[player]/page.tsx  # player detail (server) 
  team/[code]/[player]/PlayerDetailClient.tsx  # radar, reasoning, news button (client)
  methodology/page.tsx           # data sources / process / disclaimer
  api/news/route.ts              # DuckDuckGo search + Kimi summary, in-memory cache
lib/
  gonka.ts                       # shared Gonka client (from gonkarouter-integration skill)
  types.ts                       # Squad / Prediction shared types
  data.ts                        # squads.json + predictions.json loader (sample fallback)
  team.ts                        # roster/lineup/newcomer derivation
  heuristics.ts                  # local (non-model) 5-dim radar scoring
  flags.ts                       # flag emoji + zh country names
components/
  GonkaBadge.tsx                 # shared Request ID audit badge (from skill)
  ProbabilityBar.tsx
  RadarChart.tsx                 # dependency-free inline SVG radar
scripts/
  precompute.ts                  # batch dual-model prediction generator
data/
  squads.json                    # 10 teams × 26 players (2026 WC squads, pre-existing)
  predictions.sample.json        # mock data, ~6 players — committed fixture
  predictions.json               # real output of precompute.ts — gitignored
```

## Gonka integration

All model calls go through `lib/gonka.ts` → `https://api.gonkarouter.io/v1`
(`GONKA_API_KEY` env var). Models used:

- `moonshotai/Kimi-K2.6` — per-player prediction, newcomer inference, news summary
- `MiniMaxAI/MiniMax-M2.7` — independent per-player prediction (cross-check)

Every call's response `id` (Gonka Request ID) is persisted (in
`predictions.json`) or surfaced live via `GonkaBadge`, so every number on the
site is traceable back to a specific request.

## Iteration plan

- Pull in more league/injury data sources for fresher league-strength scoring.
- Calibrate against historical World Cup squad retention rates.
- Expand from 10 to all 32 qualified teams.
- Add a third model for 3-way cross-validation to reduce single-model bias.
- Replace the DuckDuckGo HTML scrape with a more stable news API.

## Known limitations / TODOs

- `scripts/precompute.ts` has not been run against the live Gonka API —
  `predictions.sample.json` (6 players, 2 teams' newcomers) stands in.
  Run it with a real `GONKA_API_KEY` before the demo if live-quality numbers
  are needed for all 260 players.
- The `/api/news` cache is in-memory only (per server instance); it resets on
  redeploy/cold start — acceptable for a hackathon demo.
- Player names in URLs are plain UTF-8 (`encodeURIComponent`), not slugs —
  fine for this dataset size, would need normalization at larger scale.
