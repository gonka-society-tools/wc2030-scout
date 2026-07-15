/**
 * x402 v2 收款逻辑(kite-testnet / PIEUSD)— 移植自队A quantscout market402/server.js
 * 流程: 无 X-PAYMENT → 402+条款;有 → Pieverse facilitator /v2/verify → /v2/settle
 */

export const PIEUSD = "0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A"; // kite-testnet PIEUSD
export const NETWORK = process.env.X402_NETWORK || "eip155:2368"; // kite-testnet CAIP-2
export const SCHEME = process.env.X402_SCHEME || "exact";
export const FACILITATOR = process.env.FACILITATOR || "https://facilitator.pieverse.io";
export const PRICE_RAW = process.env.X402_PRICE_RAW || "10000000000000000"; // 0.01 PIEUSD (18 dec)
export const PAY_TO = process.env.X402_PAY_TO || "0x5BdF76D1741403921A3235B53Cb612ae0B3C2F35"; // passport wallet (testnet)

export interface PaymentRequirements {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, string>;
}

export function paymentRequirements(): PaymentRequirements {
  return {
    scheme: SCHEME,
    network: NETWORK,
    asset: PIEUSD,
    amount: PRICE_RAW,
    payTo: PAY_TO,
    maxTimeoutSeconds: 120,
    extra: { name: "pieUSD", version: "1", merchantName: "wc2030-market" },
  };
}

export function resourceInfo(url: string) {
  return {
    url,
    description: "WC2030 player-probability trade, pay-per-request",
    mimeType: "application/json",
    serviceName: "wc2030-market",
  };
}

async function facilitate(
  path: string,
  payload: unknown,
  requirements: PaymentRequirements,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(FACILITATOR + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x402Version: 2, paymentPayload: payload, paymentRequirements: requirements }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

export type SettleResult =
  | { paid: true; tx: string | null; payer: string | null }
  | { paid: false; code: number; error: string; detail?: unknown };

/** Full verify+settle for an incoming X-PAYMENT header value. */
export async function verifyAndSettle(xPayment: string): Promise<SettleResult> {
  const requirements = paymentRequirements();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(xPayment, "base64").toString("utf8"));
  } catch {
    return { paid: false, code: 400, error: "invalid X-PAYMENT encoding" };
  }
  const verify = await facilitate("/v2/verify", payload, requirements);
  if (!verify.ok || verify.body.isValid === false) {
    return { paid: false, code: 402, error: "verification failed", detail: verify.body };
  }
  const settle = await facilitate("/v2/settle", payload, requirements);
  if (!settle.ok || settle.body.success === false) {
    return { paid: false, code: 402, error: "settlement failed", detail: settle.body };
  }
  const auth = (payload as { payload?: { authorization?: { from?: string } } }).payload?.authorization;
  return {
    paid: true,
    tx: (settle.body.transaction as string) || (settle.body.txHash as string) || null,
    payer: auth?.from ?? null,
  };
}
