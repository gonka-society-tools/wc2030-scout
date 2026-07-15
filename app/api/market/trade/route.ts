import { NextRequest, NextResponse } from "next/server";
import { applyTrade } from "@/lib/market";
import { paymentRequirements, resourceInfo, verifyAndSettle } from "@/lib/x402";

export const dynamic = "force-dynamic";

interface TradeBody {
  player?: string;
  team?: string;
  side?: "buy" | "sell";
  qty?: number;
}

/**
 * POST /api/market/trade
 * x402-gated. No X-PAYMENT header → 402 with PaymentRequirements (accepts[0]).
 * With X-PAYMENT header → verify+settle against the Pieverse facilitator, then
 * execute an in-memory trade (lib/market.ts applyTrade) and return the fill.
 */
export async function POST(req: NextRequest) {
  let body: TradeBody;
  try {
    body = (await req.json()) as TradeBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { player, team, side, qty } = body;
  if (!player || (side !== "buy" && side !== "sell") || !Number.isFinite(qty) || (qty as number) <= 0) {
    return NextResponse.json(
      { error: "body must be { player: string, side: 'buy'|'sell', qty: number>0 }" },
      { status: 400 },
    );
  }

  const requirements = paymentRequirements();
  const resource = `${req.nextUrl.origin}/api/market/trade`;

  const xPayment = req.headers.get("x-payment");
  if (!xPayment) {
    return NextResponse.json(
      {
        x402Version: 2,
        error: "payment required",
        resource: resourceInfo(resource),
        accepts: [requirements],
      },
      { status: 402 },
    );
  }

  const settlement = await verifyAndSettle(xPayment);
  if (!settlement.paid) {
    return NextResponse.json(
      { error: settlement.error, detail: settlement.detail ?? null },
      { status: 502 },
    );
  }

  const fill = applyTrade(player, side, qty as number, team);
  if (!fill) {
    return NextResponse.json({ error: "player not found" }, { status: 404 });
  }

  return NextResponse.json({
    fill: { price: fill.fillPrice, qty: fill.qty, side: fill.side },
    txRef: settlement.tx,
    payer: settlement.payer,
    newPrice: fill.newPrice,
    requestIdNote:
      "txRef is the kite-testnet settlement tx returned by the Pieverse facilitator /v2/settle call — not a real-money transaction.",
  });
}
