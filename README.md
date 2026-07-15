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

## 预测市场 Prediction Market

`/market` turns every player's 2030 retention probability into a demo,
testnet-settled "price" and lets an agent (or a human, via the UI) buy/sell it
through **x402** on **Kite testnet**. This is a hackathon demo layer, not a
real market — see the disclaimer at the bottom of this section.

### Pricing formula

```
base  = prob / 100                                   # 0..1
      # prob = dual-model mean from data/predictions.json when available,
      #        else a deterministic heuristic (age-in-2030, league tier,
      #        caps) mirroring lib/heuristics.ts's radar scoring
price = clamp(0.01, 0.99, base * (1 + 0.05 * tanh(netVolume / 20)))
      # netVolume = net buy(+)/sell(-) qty accumulated in-memory since the
      #             server process started (seeded per-player so the board
      #             isn't perfectly flat on a cold start)
```

`data/market-base.json` (written by `scripts/reprice.ts`) is the preferred
source of `{prob, source}` per player — `lib/market.ts` reads it when present
and falls back to computing `prob` in-process (from `predictions.json` +
`baselineProbability()`) when the file hasn't been generated yet (e.g. a
fresh local checkout before the first reprice run).

### x402 flow

```
   client / agent                    wc2030-scout                  Pieverse facilitator
        |                                  |                                |
        |-- POST /api/market/trade ------->|                                |
        |   (no X-PAYMENT header)          |                                |
        |<-- 402 + PaymentRequirements ----|                                |
        |    {scheme, network, asset,      |                                |
        |     amount, payTo, ...}          |                                |
        |                                  |                                |
        | sign EIP-3009                    |                                |
        | transferWithAuthorization        |                                |
        | (PIEUSD, kite-testnet)           |                                |
        |                                  |                                |
        |-- POST /api/market/trade ------->|                                |
        |   X-PAYMENT: base64(payload)     |-- POST /v2/verify ------------>|
        |                                  |<-- isValid: true --------------|
        |                                  |-- POST /v2/settle ------------>|
        |                                  |<-- success: true, tx ----------|
        |<-- 200 { fill, txRef,            |                                |
        |          newPrice }              |                                |
```

- `lib/x402.ts` — ports the exact verify/settle request/response shapes used
  by the reference `quantscout/market402/server.js`: scheme `"exact"`,
  network `"eip155:2368"` (kite-testnet CAIP-2), asset PIEUSD
  (`0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A`), a flat trade fee of
  `10000000000000000` raw units (0.01 PIEUSD, 18 decimals), facilitator
  `https://facilitator.pieverse.io` (`/v2/verify`, `/v2/settle`).
- `app/api/market/trade/route.ts` — the gated endpoint: 402 without
  `X-PAYMENT`, verify+settle then execute an in-memory trade with `X-PAYMENT`.
- `scripts/trade-agent.mjs` — a reference autonomous buyer: scans
  `/api/market/board` for the biggest `|prob/100 − price|` divergence, hits
  `/api/market/trade`, and on 402 either stops and prints the terms
  (`--dry-run`) or signs the EIP-3009 authorization with `AGENT_PRIVATE_KEY`
  and completes the trade.
- The `/market` UI's 买入/卖出 buttons intentionally POST without a payment
  header first, so every trade opens an **"Agent 支付入口 (x402 · Kite
  testnet)"** modal showing the raw `PaymentRequirements`, a copyable
  equivalent `curl`, and the equivalent `node scripts/trade-agent.mjs
  --dry-run` command — the point of the demo is to make the x402 handshake
  visible, not to hide it behind a normal checkout button.

### Weekly refresh

`.github/workflows/weekly-update.yml` runs every Monday (`17 3 * * 1` UTC):
`npx tsx scripts/precompute.ts` (refresh dual-model predictions) →
`npx tsx scripts/reprice.ts` (recompute `data/market-base.json`) → commit +
push `data/predictions.json` and `data/market-base.json` if they changed. If
this repo is git-integrated with Vercel, a push to the default branch
triggers an automatic redeploy — no separate deploy step in the workflow.

### Env vars

| Var | Used by | Notes |
|---|---|---|
| `X402_PAY_TO` | `lib/x402.ts` | Merchant payout address; falls back to the same testnet passport wallet quantscout's `market402/server.js` uses if unset. |
| `AGENT_PRIVATE_KEY` | `scripts/trade-agent.mjs` | EOA private key used to sign the EIP-3009 `transferWithAuthorization`. Only needed for a real (non-`--dry-run`) trade. |
| `GONKA_API_KEY` | `.github/workflows/weekly-update.yml` (as a **GitHub secret**), `scripts/precompute.ts` | Same key used elsewhere in the app for Gonka calls. |

### Disclaimer

> ⚠️ **This is a testnet demo state, not real assets, not gambling.** Prices
> are synthetic, derived from AI model probability estimates plus in-memory
> demo order flow that resets on every server restart. PIEUSD on kite-testnet
> has no real-world value. Nothing here constitutes betting, investment, or
> financial advice. See `/market`'s footer and `/methodology` for the same
> disclaimer in context.

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
