#!/usr/bin/env node
/**
 * trade-agent.mjs — autonomous x402 trading demo agent for the WC2030 market.
 *
 * Flow:
 *   1. GET /api/market/board (free) — scan all listed rows for the biggest
 *      |prob/100 - price| divergence ("apparent mispricing").
 *   2. If price < prob/100 → buy (looks cheap); else → sell (looks rich).
 *   3. POST /api/market/trade → expect 402 with PaymentRequirements.
 *      --dry-run stops here and pretty-prints the terms + intended trade.
 *   4. Otherwise, sign an EIP-3009 transferWithAuthorization (same shape as
 *      quantscout's x402-buyer/buyer.mjs) with AGENT_PRIVATE_KEY, retry the
 *      POST with X-PAYMENT, and print the fill.
 *
 * Usage:
 *   node scripts/trade-agent.mjs --dry-run [--base http://localhost:3000]
 *   AGENT_PRIVATE_KEY=0x... node scripts/trade-agent.mjs [--base http://localhost:3000]
 *
 * env:
 *   MARKET_BASE_URL   — default http://localhost:3000, overridden by --base
 *   AGENT_PRIVATE_KEY — EOA private key used to sign the EIP-3009 authorization
 */

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const baseFlagIdx = args.indexOf("--base");
const BASE_URL =
  (baseFlagIdx >= 0 ? args[baseFlagIdx + 1] : null) ||
  process.env.MARKET_BASE_URL ||
  "http://localhost:3000";

const PIEUSD = "0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A";
const CHAIN_ID = 2368; // kite-testnet
const DOMAIN = { name: "pieUSD", version: "1", chainId: CHAIN_ID, verifyingContract: PIEUSD };
const TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

function log(...a) {
  console.log(...a);
}

/** Pick the row on the board with the largest |prob/100 - price| divergence. */
async function pickMispriced() {
  const res = await fetch(`${BASE_URL}/api/market/board`);
  if (!res.ok) throw new Error(`GET /api/market/board failed: HTTP ${res.status}`);
  const board = await res.json();

  // Union of the ranked lists is enough signal; dedupe by slug+team.
  const rows = [...board.top, ...board.movers, ...board.cheapest, ...(board.mostTraded ?? [])];
  const seen = new Map();
  for (const r of rows) seen.set(`${r.team}::${r.slug}`, r);
  const all = [...seen.values()];
  if (all.length === 0) throw new Error("board returned no rows");

  let best = null;
  let bestDivergence = -Infinity;
  for (const r of all) {
    const divergence = Math.abs(r.prob / 100 - r.price);
    if (divergence > bestDivergence) {
      bestDivergence = divergence;
      best = r;
    }
  }
  const side = best.price < best.prob / 100 ? "buy" : "sell";
  return { row: best, side, divergence: bestDivergence };
}

async function main() {
  const { row, side, divergence } = await pickMispriced();
  const qty = 1;
  log(
    `[scan] picked ${row.name} (${row.team}/${row.slug}) — price=${row.price} prob=${row.prob}% divergence=${divergence.toFixed(4)} → ${side}`,
  );

  const tradeUrl = `${BASE_URL}/api/market/trade`;
  const tradeBody = { player: row.slug, team: row.team, side, qty };

  const r1 = await fetch(tradeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tradeBody),
  });

  if (r1.status !== 402) {
    const data = await r1.json().catch(() => null);
    log(`[trade] unexpected status ${r1.status} (expected 402 without X-PAYMENT):`);
    log(JSON.stringify(data, null, 2));
    process.exitCode = 1;
    return;
  }

  const terms402 = await r1.json();
  const requirements = terms402.accepts?.[0];
  if (!requirements) throw new Error("402 response had no accepts[0] PaymentRequirements");

  if (DRY_RUN) {
    log("\n=== 402 Payment Required ===");
    log(JSON.stringify(terms402, null, 2));
    log("\n=== Intended trade (not executed, --dry-run) ===");
    log(JSON.stringify({ ...tradeBody, note: `would buy/sell against divergence=${divergence.toFixed(4)}` }, null, 2));
    log("\n=== Equivalent curl (without payment, to reproduce the 402) ===");
    log(
      `curl -s -X POST ${tradeUrl} -H "Content-Type: application/json" -d '${JSON.stringify(tradeBody)}'`,
    );
    return;
  }

  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    log("\nAGENT_PRIVATE_KEY not set — cannot sign the EIP-3009 authorization to complete the trade.");
    log("Re-run with --dry-run to just inspect the PaymentRequirements, or set AGENT_PRIVATE_KEY.");
    process.exitCode = 1;
    return;
  }

  const { ethers } = await import("ethers");
  const wallet = new ethers.Wallet(privateKey);

  const now = Math.floor(Date.now() / 1000);
  const authNum = {
    from: wallet.address,
    to: requirements.payTo,
    value: requirements.amount,
    validAfter: 0,
    validBefore: now + (requirements.maxTimeoutSeconds || 300),
    nonce: ethers.hexlify(ethers.randomBytes(32)),
  };
  const signature = await wallet.signTypedData(DOMAIN, TYPES, authNum);
  const authorization = {
    ...authNum,
    value: String(authNum.value),
    validAfter: "0",
    validBefore: String(authNum.validBefore),
  };

  const paymentPayload = {
    x402Version: 2,
    accepted: requirements,
    payload: { signature, authorization },
  };
  const xPayment = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

  log(`[pay] signed EIP-3009 authorization as ${wallet.address}, retrying with X-PAYMENT...`);

  const r2 = await fetch(tradeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Payment": xPayment },
    body: JSON.stringify(tradeBody),
  });
  const data = await r2.json().catch(() => null);

  if (!r2.ok) {
    log(`[trade] failed: HTTP ${r2.status}`);
    log(JSON.stringify(data, null, 2));
    process.exitCode = 1;
    return;
  }

  log("\n=== Fill ===");
  log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error("ERR:", err.message);
  process.exitCode = 1;
});
